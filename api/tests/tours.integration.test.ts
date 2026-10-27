import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Server } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { closePool } from "../src/db/pool.js";
import { closeAllOpenSessions } from "../src/modules/presence/presence.repository.js";
import { setPresenceIo } from "../src/modules/presence/presence.service.js";
import { setHubIo } from "../src/realtime/hub.js";
import { initRealtime } from "../src/realtime/socket.js";
import { bearer, loginAs } from "./helpers/http.js";
import { resetTestDb, runDbTests } from "./helpers/testDb.js";

// Nhóm tham quan (PRD v1.0, FE-10, mục 4.7, 12). Chạy: RUN_DB_TESTS=1 npm test
const app = createApp();
const api = (path: string) => `/api/v1${path}`;
let http: HttpServer;
let io: Server;
let url: string;
const sockets: Socket[] = [];

function open(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = connect(url, { auth: { token }, query: { clientType: "mobile" }, transports: ["websocket"], reconnection: false });
    sockets.push(s);
    s.once("presence.session", () => resolve(s));
    s.once("connect_error", reject);
  });
}

function next<T>(s: Socket, event: string, pred: (p: T) => boolean = () => true): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Không nhận ${event} trong 3 giây`)), 3000);
    const handler = (p: T) => {
      if (!pred(p)) return;
      clearTimeout(timer);
      s.off(event, handler);
      resolve(p);
    };
    s.on(event, handler);
  });
}

describe.skipIf(!runDbTests)("Nhóm tham quan trên SQL Server + Socket.IO", () => {
  const t: Record<string, string> = {};

  beforeAll(async () => {
    await closePool();
    await resetTestDb();
    http = createServer(app);
    io = initRealtime(http);
    await new Promise<void>((r) => http.listen(0, r));
    url = `http://localhost:${(http.address() as AddressInfo).port}`;
    for (const u of ["guide1", "guide2", "user1", "user2", "user3", "user4"]) t[u] = await loginAs(app, `${u}@demo.vn`);
  }, 120_000);

  afterEach(async () => {
    for (const s of sockets.splice(0)) s.disconnect();
    await new Promise((r) => setTimeout(r, 200));
    await closeAllOpenSessions();
  });

  afterAll(async () => {
    setPresenceIo(undefined);
    setHubIo(undefined);
    await new Promise<void>((r) => io.close(() => r()));
    await closePool();
  });

  it("khách thường không tạo được nhóm; hướng dẫn viên tạo nhóm và là thành viên đầu tiên", async () => {
    expect((await request(app).post(api("/tours")).set(bearer(t.user1!)).send({ name: "X" })).status).toBe(403);
    const res = await request(app).post(api("/tours")).set(bearer(t.guide1!)).send({ name: "Đoàn Hàn Quốc", maxMembers: 3 });
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(res.body).toMatchObject({ name: "Đoàn Hàn Quốc", status: "active", memberCount: 1, guide: { fullName: expect.any(String) } });
    const me = await request(app).get(api("/me/tour")).set(bearer(t.guide1!));
    expect(me.body.tour.code).toBe(res.body.code);
  });

  it("tham gia, tham gia lại (idempotent), nhóm đầy, đang ở nhóm khác", async () => {
    const { body: tour } = await request(app).get(api("/me/tour")).set(bearer(t.guide1!));
    const code = (tour.tour.code as string).toLowerCase(); // mã nhóm không phân biệt hoa thường
    expect((await request(app).post(api(`/tours/${code}/join`)).set(bearer(t.user1!))).status).toBe(201);
    expect((await request(app).post(api(`/tours/${code}/join`)).set(bearer(t.user1!))).status).toBe(200);
    expect((await request(app).post(api(`/tours/${code}/join`)).set(bearer(t.user2!))).status).toBe(201);
    const full = await request(app).post(api(`/tours/${code}/join`)).set(bearer(t.user3!));
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe("TOUR_FULL");

    const other = await request(app).post(api("/tours")).set(bearer(t.guide2!)).send({ name: "Đoàn Nhật" });
    const busy = await request(app).post(api(`/tours/${other.body.code}/join`)).set(bearer(t.user1!));
    expect(busy.status).toBe(409);
    expect(busy.body.error).toMatchObject({ code: "ALREADY_IN_TOUR", details: { code: tour.tour.code } });
    expect((await request(app).post(api("/tours/ZZZZZZ/join")).set(bearer(t.user3!))).status).toBe(404);
  });

  it("danh sách thành viên: chỉ thành viên/hướng dẫn viên/admin xem được", async () => {
    const { body } = await request(app).get(api("/me/tour")).set(bearer(t.user1!));
    const id = body.tour.id as number;
    const res = await request(app).get(api(`/tours/${id}/members`)).set(bearer(t.user1!));
    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(3);
    expect(res.body.members[0]).toMatchObject({ isGuide: true, online: false, currentPlaceId: null });
    expect((await request(app).get(api(`/tours/${id}/members`)).set(bearer(t.user4!))).status).toBe(403);
  });

  it("realtime: thành viên nghe một điểm → cả nhóm nhận tour.member.updated (chỉ placeId, không tọa độ)", async () => {
    const { body } = await request(app).get(api("/me/tour")).set(bearer(t.user1!));
    const tourId = body.tour.id as number;
    const guide = await open(t.guide1!);
    const member = await open(t.user1!);
    const update = next<Record<string, unknown>>(guide, "tour.member.updated", (p) => p.currentPlaceId === 2);
    const ack = await member.emitWithAck("tour.position", { placeId: 2 });
    expect(ack).toEqual({ ok: true, tourId });
    const p = await update;
    expect(p).toMatchObject({ tourId, currentPlaceId: 2, online: true });
    expect(p).not.toHaveProperty("lat");

    const members = await request(app).get(api(`/tours/${tourId}/members`)).set(bearer(t.guide1!));
    const m = members.body.members.find((x: { currentPlaceCode: string | null }) => x.currentPlaceCode === "002");
    expect(m).toMatchObject({ online: true });

    // Thành viên rời nhóm qua REST → cả nhóm nhận tour.member.left
    const left = next(guide, "tour.member.left");
    expect((await request(app).post(api(`/tours/${tourId}/leave`)).set(bearer(t.user2!))).status).toBe(204);
    expect(await left).toMatchObject({ tourId });
  });

  it("chỉ hướng dẫn viên của nhóm/admin kết thúc được; sau khi kết thúc không tham gia được", async () => {
    const { body } = await request(app).get(api("/me/tour")).set(bearer(t.guide1!));
    const { id, code } = body.tour as { id: number; code: string };
    expect((await request(app).post(api(`/tours/${id}/end`)).set(bearer(t.guide2!))).status).toBe(403);

    const member = await open(t.user1!);
    const ended = next(member, "tour.ended");
    expect((await request(app).post(api(`/tours/${id}/end`)).set(bearer(t.guide1!))).status).toBe(204);
    expect(await ended).toMatchObject({ tourId: id });

    const late = await request(app).post(api(`/tours/${code}/join`)).set(bearer(t.user3!));
    expect(late.body.error.code).toBe("TOUR_ENDED");
    expect((await request(app).get(api("/me/tour")).set(bearer(t.user1!))).body.tour).toBeNull();
    expect((await request(app).post(api(`/tours/${id}/end`)).set(bearer(t.guide1!))).status).toBe(409);
  });
});
