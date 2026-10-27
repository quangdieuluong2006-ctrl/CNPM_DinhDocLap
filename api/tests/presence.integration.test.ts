import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Server } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { closePool, getPool } from "../src/db/pool.js";
import { closeAllOpenSessions } from "../src/modules/presence/presence.repository.js";
import { runCleanupOnce, setPresenceIo } from "../src/modules/presence/presence.service.js";
import { initRealtime } from "../src/realtime/socket.js";
import { resetTestDb, runDbTests } from "./helpers/testDb.js";

// Chạy: RUN_DB_TESTS=1 DB_PASSWORD=... npm test  (cần SQL Server đang chạy)
// Mô phỏng đúng câu hỏi "làm sao biết có 4 user đang hoạt động?" (TC-34, TC-35).
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "Demo@12345";
const app = createApp();
let http: HttpServer;
let io: Server;
let url: string;
const sockets: Socket[] = [];

async function login(email: string, clientType: "web" | "admin" | "mobile" = "mobile"): Promise<string> {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password: SEED_PASSWORD, clientType });
  expect(res.status).toBe(200);
  return res.body.accessToken as string;
}

// Mở một kết nối Socket.IO (một tab/ứng dụng) và chờ server ghi xong phiên.
function open(token: string | undefined, clientType: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = connect(url, { auth: token ? { token } : {}, query: { clientType }, transports: ["websocket"], reconnection: false });
    sockets.push(s);
    s.once("presence.session", () => resolve(s));
    s.once("connect_error", (err) => reject(err));
  });
}

function connectError(token: string | undefined, clientType: string): Promise<{ message: string; data?: { code: string } }> {
  return open(token, clientType).then(
    () => {
      throw new Error("Đáng lẽ phải bị từ chối");
    },
    (err: { message: string; data?: { code: string } }) => err,
  );
}

// Chờ sự kiện presence.update thỏa điều kiện (tối đa 3 giây – NFR-16).
function waitUpdate(admin: Socket, pred: (p: { activeUsers: number }) => boolean): Promise<{ activeUsers: number; changed: unknown }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Không nhận presence.update trong 3 giây")), 3000);
    const handler = (p: { activeUsers: number; changed: unknown }) => {
      if (pred(p)) {
        clearTimeout(timer);
        admin.off("presence.update", handler);
        resolve(p);
      }
    };
    admin.on("presence.update", handler);
  });
}

async function presence(adminToken: string, query = "") {
  const res = await request(app).get(`/api/v1/admin/presence${query}`).set("Authorization", `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  return res.body as { count: number; activeUsers: number; users: { email: string; openSessions: number; clientTypes: string[] }[] };
}

describe.skipIf(!runDbTests)("Presence – người dùng đang hoạt động (FE-12) trên SQL Server", () => {
  let adminToken: string;

  beforeAll(async () => {
    await closePool();
    await resetTestDb();
    http = createServer(app);
    io = initRealtime(http);
    await new Promise<void>((r) => http.listen(0, r));
    url = `http://localhost:${(http.address() as AddressInfo).port}`;
    adminToken = await login("admin@demo.vn", "admin");
  }, 120_000);

  afterEach(async () => {
    for (const s of sockets.splice(0)) s.disconnect();
    await new Promise((r) => setTimeout(r, 200));
    await closeAllOpenSessions();
  });

  afterAll(async () => {
    setPresenceIo(undefined);
    await new Promise<void>((r) => io.close(() => r()));
    await closePool();
  });

  it("từ chối bắt tay: thiếu token, user thường vào kênh admin", async () => {
    expect((await connectError(undefined, "web")).data?.code).toBe("AUTH_REQUIRED");
    const userToken = await login("user1@demo.vn");
    expect((await connectError(userToken, "admin")).data?.code).toBe("FORBIDDEN");
  });

  it("4 user đăng nhập → Admin thấy đúng 4; user mở thêm tab không làm tăng số (TC-34)", async () => {
    const admin = await open(adminToken, "admin");
    const tokens = await Promise.all(["user1@demo.vn", "user2@demo.vn", "user3@demo.vn", "user4@demo.vn"].map((e) => login(e)));

    const reached4 = waitUpdate(admin, (p) => p.activeUsers === 4);
    await open(tokens[0], "web");
    await open(tokens[1], "web");
    await open(tokens[2], "mobile");
    await open(tokens[3], "web");
    expect((await reached4).activeUsers).toBe(4);

    await open(tokens[0], "web"); // user1 mở tab thứ hai
    const body = await presence(adminToken);
    expect(body.activeUsers).toBe(4);
    expect(body.count).toBe(4);
    expect(body.users.find((u) => u.email === "user1@demo.vn")?.openSessions).toBe(2);
    expect(body.users.find((u) => u.email === "user3@demo.vn")?.clientTypes).toEqual(["mobile"]);

    // Số trên API bằng đúng truy vấn SQL trực tiếp (AC4)
    const pool = await getPool();
    const r = await pool.request().query<{ n: number }>("SELECT COUNT(*) AS n FROM dbo.v_active_users WHERE role = 'user'");
    expect(r.recordset[0]!.n).toBe(4);

    // Bộ lọc: role=all tính cả admin; clientType=mobile chỉ còn user3
    expect((await presence(adminToken, "?role=all")).count).toBe(5);
    expect((await presence(adminToken, "?clientType=mobile")).users.map((u) => u.email)).toEqual(["user3@demo.vn"]);
  });

  it("đóng tab → số giảm ngay; còn tab khác thì vẫn tính là đang hoạt động (TC-35)", async () => {
    const admin = await open(adminToken, "admin");
    const [t1, t2] = await Promise.all([login("user1@demo.vn"), login("user2@demo.vn")]);
    const tabA = await open(t1, "web");
    await open(t1, "web");
    const u2 = await open(t2, "mobile");
    expect((await presence(adminToken)).activeUsers).toBe(2);

    const dropTo1 = waitUpdate(admin, (p) => p.activeUsers === 1);
    u2.disconnect();
    const update = await dropTo1;
    expect(update.changed).toMatchObject({ type: "offline" });

    tabA.disconnect(); // user1 còn một tab
    await new Promise((r) => setTimeout(r, 300));
    expect((await presence(adminToken)).activeUsers).toBe(1);
  });

  it("presence.ping cập nhật last_seen_at; mất nhịp tim quá 60 giây thì bị dọn", async () => {
    const pool = await getPool();
    const token = await login("user5@demo.vn");
    const s = await open(token, "mobile");

    // Giả lập lần nhịp tim trước cách đây 50 giây, rồi gửi ping
    await pool.request().query("UPDATE dbo.user_sessions SET last_seen_at = DATEADD(SECOND, -50, SYSUTCDATETIME()) WHERE disconnected_at IS NULL");
    const ack = (await s.timeout(2000).emitWithAck("presence.ping", {})) as { ok: boolean };
    expect(ack.ok).toBe(true);
    const fresh = await pool.request().query<{ age: number }>(
      "SELECT DATEDIFF(SECOND, last_seen_at, SYSUTCDATETIME()) AS age FROM dbo.user_sessions WHERE disconnected_at IS NULL",
    );
    expect(fresh.recordset[0]!.age).toBeLessThanOrEqual(2);

    // Mất mạng đột ngột: không ping nữa, last_seen_at cũ 2 phút → tác vụ dọn đóng phiên
    await pool.request().query("UPDATE dbo.user_sessions SET last_seen_at = DATEADD(SECOND, -120, SYSUTCDATETIME()) WHERE disconnected_at IS NULL");
    expect((await presence(adminToken)).activeUsers).toBe(0); // view đã loại ngay
    const closed = await runCleanupOnce();
    expect(closed).toHaveLength(1);
    const open_ = await pool.request().query<{ n: number }>("SELECT COUNT(*) AS n FROM dbo.user_sessions WHERE disconnected_at IS NULL");
    expect(open_.recordset[0]!.n).toBe(0);

    // Socket vẫn sống (máy thức dậy) → ping tiếp sẽ mở lại phiên mới
    const again = (await s.timeout(2000).emitWithAck("presence.ping", {})) as { ok: boolean };
    expect(again.ok).toBe(true);
    expect((await presence(adminToken)).activeUsers).toBe(1);
  });

  it("POST /presence/heartbeat dự phòng: tính là đang hoạt động, gọi lại dùng chung một phiên", async () => {
    const token = await login("user6@demo.vn");
    const first = await request(app).post("/api/v1/presence/heartbeat").set("Authorization", `Bearer ${token}`).send({ clientType: "mobile" });
    expect(first.status).toBe(200);
    const second = await request(app).post("/api/v1/presence/heartbeat").set("Authorization", `Bearer ${token}`).send({ clientType: "mobile" });
    expect(second.body.sessionId).toBe(first.body.sessionId);
    expect((await presence(adminToken)).users.map((u) => u.email)).toEqual(["user6@demo.vn"]);
  });

  it("GET /admin/join-link trả link trang chủ Web User (khách dùng ngay, không đăng ký)", async () => {
    const res = await request(app).get("/api/v1/admin/join-link").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    for (const l of res.body.links as { url: string }[]) expect(l.url).toMatch(/^http:\/\/[\d.]+:5173\/$/);
  });

  it("GET /admin/stats trả 6 số liệu + 7 ngày; user thường gọi /admin/* bị 403 (TC-41)", async () => {
    const res = await request(app).get("/api/v1/admin/stats").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ totalUsers: 8, activeUsers: 0, publishedPlaces: 12, pendingContents: 96 });
    for (const k of ["visitsToday", "activeTours"]) expect(typeof res.body[k]).toBe("number");
    expect(res.body.visitsByDay).toHaveLength(7);
    expect(res.body.topPlaces.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.languages)).toBe(true);

    const userToken = await login("user2@demo.vn");
    for (const path of ["/api/v1/admin/stats", "/api/v1/admin/presence", "/api/v1/admin/join-link"]) {
      const forbidden = await request(app).get(path).set("Authorization", `Bearer ${userToken}`);
      expect(forbidden.status).toBe(403);
      expect(forbidden.body.error.code).toBe("FORBIDDEN");
    }
  });
});
