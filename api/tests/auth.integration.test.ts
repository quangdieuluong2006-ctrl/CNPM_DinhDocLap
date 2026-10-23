import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { closePool, getPool, sql } from "../src/db/pool.js";
import { resetTestDb, runDbTests } from "./helpers/testDb.js";

// Chạy: RUN_DB_TESTS=1 DB_PASSWORD=... npm test  (cần SQL Server đang chạy)
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "Demo@12345";
const app = createApp();

// Lấy giá trị cookie từ header Set-Cookie của response.
function cookieValue(res: request.Response, name: string): string | undefined {
  const raw = res.headers["set-cookie"] as unknown as string[] | undefined;
  const line = raw?.find((c) => c.startsWith(`${name}=`));
  return line?.split(";")[0]?.slice(name.length + 1);
}

async function countLogs(action: string, userId?: number): Promise<number> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("a", sql.VarChar(50), action)
    .input("u", sql.Int, userId ?? null)
    .query<{ n: number }>("SELECT COUNT(*) AS n FROM dbo.activity_logs WHERE action = @a AND (@u IS NULL OR user_id = @u)");
  return r.recordset[0]!.n;
}

describe.skipIf(!runDbTests)("API xác thực (FE-01) trên SQL Server", () => {
  beforeAll(async () => {
    await closePool();
    await resetTestDb();
  }, 120_000);

  afterAll(async () => {
    await closePool();
  });

  describe("POST /api/v1/auth/register", () => {
    it("tạo tài khoản, trả access token, không lộ password_hash", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ email: "  Moi@Demo.VN ", password: "matkhau123", fullName: "Người Mới", clientType: "mobile" });
      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.refreshToken).toBeTruthy(); // mobile nhận refresh token trong body
      expect(res.body.user).toMatchObject({ email: "moi@demo.vn", role: "user", uiLocale: "vi", narrationLang: null });
      expect(JSON.stringify(res.body)).not.toContain("password");
      expect(await countLogs("auth.register", res.body.user.id)).toBe(1);
    });

    it("email đã tồn tại (không phân biệt hoa thường) → 409 EMAIL_TAKEN", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ email: "USER1@demo.vn", password: "matkhau123", fullName: "Trùng" });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("EMAIL_TAKEN");
    });

    it("mật khẩu yếu → 400 VALIDATION_ERROR kèm tên trường", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ email: "yeu@demo.vn", password: "chiconchu", fullName: "Yếu" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details.fields[0].path).toEqual(["password"]);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("Web: trả access token + csrfToken, refresh token chỉ nằm trong cookie HttpOnly", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "user1@demo.vn", password: SEED_PASSWORD, clientType: "web" });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.expiresIn).toBe(15 * 60);
      expect(res.body.refreshToken).toBeUndefined();
      const cookies = (res.headers["set-cookie"] as unknown as string[]).join("\n");
      expect(cookies).toMatch(/rt_web=[^;]+;.*Path=\/api\/v1\/auth;.*HttpOnly;.*SameSite=Lax/);
      expect(cookieValue(res, "csrf_web")).toBe(res.body.csrfToken);
    });

    it("sai mật khẩu hoặc email không tồn tại → cùng một lỗi 401, có ghi nhật ký", async () => {
      const before = await countLogs("auth.login_failed");
      const wrongPass = await request(app).post("/api/v1/auth/login").send({ email: "user1@demo.vn", password: "sai12345" });
      const noUser = await request(app).post("/api/v1/auth/login").send({ email: "khongco@demo.vn", password: "sai12345" });
      for (const res of [wrongPass, noUser]) {
        expect(res.status).toBe(401);
        expect(res.body.error).toMatchObject({ code: "AUTH_INVALID_CREDENTIALS", message: "Email hoặc mật khẩu không đúng" });
      }
      expect(await countLogs("auth.login_failed")).toBe(before + 2);
    });

    it("tài khoản bị khóa → 403 ACCOUNT_LOCKED", async () => {
      const pool = await getPool();
      await pool.request().query("UPDATE dbo.users SET status = 'locked' WHERE email = 'user6@demo.vn'");
      const res = await request(app).post("/api/v1/auth/login").send({ email: "user6@demo.vn", password: SEED_PASSWORD });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ACCOUNT_LOCKED");
      await pool.request().query("UPDATE dbo.users SET status = 'active' WHERE email = 'user6@demo.vn'");
    });

    it("user thường đăng nhập Web Admin → 403 FORBIDDEN; admin thì được", async () => {
      const user = await request(app).post("/api/v1/auth/login").send({ email: "user2@demo.vn", password: SEED_PASSWORD, clientType: "admin" });
      expect(user.status).toBe(403);
      expect(user.body.error.code).toBe("FORBIDDEN");

      const admin = await request(app).post("/api/v1/auth/login").send({ email: "admin@demo.vn", password: SEED_PASSWORD, clientType: "admin" });
      expect(admin.status).toBe(200);
      expect(admin.body.user.role).toBe("admin");
      expect(cookieValue(admin, "rt_admin")).toBeTruthy(); // cookie riêng, không đè rt_web
    });

    it("quá số lần thử → 429 RATE_LIMITED kèm Retry-After", async () => {
      const limited = createApp({ loginRateLimitMax: 2 });
      const body = { email: "user3@demo.vn", password: "sai12345" };
      await request(limited).post("/api/v1/auth/login").send(body);
      await request(limited).post("/api/v1/auth/login").send(body);
      const res = await request(limited).post("/api/v1/auth/login").send(body);
      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe("RATE_LIMITED");
      expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    });

    it("đăng nhập thành công không bị tính vào giới hạn", async () => {
      const limited = createApp({ loginRateLimitMax: 2 });
      for (let i = 0; i < 4; i++) {
        const res = await request(limited).post("/api/v1/auth/login").send({ email: "user5@demo.vn", password: SEED_PASSWORD });
        expect(res.status).toBe(200);
      }
    });
  });

  describe("GET /api/v1/me", () => {
    it("trả hồ sơ khi có access token hợp lệ", async () => {
      const login = await request(app).post("/api/v1/auth/login").send({ email: "user2@demo.vn", password: SEED_PASSWORD });
      const res = await request(app).get("/api/v1/me").set("Authorization", `Bearer ${login.body.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ email: "user2@demo.vn", fullName: "Trần Thị Bình", role: "user", narrationLang: "vi" });
      expect(res.body).not.toHaveProperty("password_hash");
    });

    it("thiếu token → 401 AUTH_REQUIRED; token giả → 401 AUTH_TOKEN_INVALID", async () => {
      const none = await request(app).get("/api/v1/me");
      expect(none.status).toBe(401);
      expect(none.body.error.code).toBe("AUTH_REQUIRED");
      const fake = await request(app).get("/api/v1/me").set("Authorization", "Bearer abc.def.ghi");
      expect(fake.status).toBe(401);
      expect(fake.body.error.code).toBe("AUTH_TOKEN_INVALID");
    });
  });

  describe("POST /api/v1/auth/refresh và /logout", () => {
    it("Mobile: xoay vòng token; dùng lại token cũ → thu hồi toàn bộ phiên", async () => {
      const login = await request(app).post("/api/v1/auth/login").send({ email: "user4@demo.vn", password: SEED_PASSWORD, clientType: "mobile" });
      const first = login.body.refreshToken as string;

      const r1 = await request(app).post("/api/v1/auth/refresh").send({ clientType: "mobile", refreshToken: first });
      expect(r1.status).toBe(200);
      const second = r1.body.refreshToken as string;
      expect(second).not.toBe(first);

      // Kẻ gian dùng lại token cũ → bị từ chối, và token mới của chủ tài khoản cũng mất hiệu lực.
      const reuse = await request(app).post("/api/v1/auth/refresh").send({ clientType: "mobile", refreshToken: first });
      expect(reuse.status).toBe(401);
      expect(reuse.body.error.code).toBe("AUTH_REFRESH_INVALID");
      const afterReuse = await request(app).post("/api/v1/auth/refresh").send({ clientType: "mobile", refreshToken: second });
      expect(afterReuse.status).toBe(401);
      // Cả hai lần đều dùng token đã bị thu hồi nên đều được ghi nhật ký cảnh báo.
      expect(await countLogs("auth.refresh_reuse", login.body.user.id)).toBe(2);
    });

    it("CSDL chỉ lưu SHA-256 của refresh token, không lưu token gốc", async () => {
      const login = await request(app).post("/api/v1/auth/login").send({ email: "user5@demo.vn", password: SEED_PASSWORD, clientType: "mobile" });
      const pool = await getPool();
      const r = await pool
        .request()
        .input("t", sql.NVarChar, login.body.refreshToken)
        .query<{ n: number }>("SELECT COUNT(*) AS n FROM dbo.refresh_tokens WHERE token_hash = @t");
      expect(r.recordset[0]!.n).toBe(0);
    });

    it("Web: refresh cần cookie + header X-CSRF-Token khớp", async () => {
      const agent = request.agent(app);
      const login = await agent.post("/api/v1/auth/login").send({ email: "user1@demo.vn", password: SEED_PASSWORD });

      const noCsrf = await agent.post("/api/v1/auth/refresh").send({ clientType: "web" });
      expect(noCsrf.status).toBe(403);
      expect(noCsrf.body.error.code).toBe("CSRF_INVALID");

      const ok = await agent.post("/api/v1/auth/refresh").set("X-CSRF-Token", login.body.csrfToken).send({ clientType: "web" });
      expect(ok.status).toBe(200);
      expect(ok.body.accessToken).toBeTruthy();
      expect(cookieValue(ok, "rt_web")).toBeTruthy(); // cookie được thay bằng token mới
    });

    it("Web: logout thu hồi token, xóa cookie; refresh sau đó thất bại", async () => {
      const agent = request.agent(app);
      const login = await agent.post("/api/v1/auth/login").send({ email: "user2@demo.vn", password: SEED_PASSWORD });
      const oldCookie = cookieValue(login, "rt_web")!;
      const csrf = login.body.csrfToken as string;

      const out = await agent.post("/api/v1/auth/logout").set("X-CSRF-Token", csrf).send({ clientType: "web" });
      expect(out.status).toBe(204);
      expect(cookieValue(out, "rt_web")).toBe(""); // Set-Cookie rỗng = xóa cookie
      expect(await countLogs("auth.logout", login.body.user.id)).toBeGreaterThanOrEqual(1);

      // Gửi lại cookie cũ (giả sử bị đánh cắp trước khi logout) → không dùng được nữa.
      const again = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [`rt_web=${oldCookie}`, `csrf_web=${csrf}`])
        .set("X-CSRF-Token", csrf)
        .send({ clientType: "web" });
      expect(again.status).toBe(401);
    });

    it("refresh bị từ chối khi tài khoản đã bị khóa", async () => {
      const login = await request(app).post("/api/v1/auth/login").send({ email: "user3@demo.vn", password: SEED_PASSWORD, clientType: "mobile" });
      const pool = await getPool();
      await pool.request().query("UPDATE dbo.users SET status = 'locked' WHERE email = 'user3@demo.vn'");
      const res = await request(app).post("/api/v1/auth/refresh").send({ clientType: "mobile", refreshToken: login.body.refreshToken });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ACCOUNT_LOCKED");
      const me = await request(app).get("/api/v1/me").set("Authorization", `Bearer ${login.body.accessToken}`);
      expect(me.status).toBe(403);
      await pool.request().query("UPDATE dbo.users SET status = 'active' WHERE email = 'user3@demo.vn'");
    });
  });
});
