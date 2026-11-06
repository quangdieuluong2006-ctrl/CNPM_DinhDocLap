import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { migrate } from "../src/db/migrate.js";
import { closePool, getPool, sql } from "../src/db/pool.js";
import { seed } from "../src/db/seed.js";
import { resetTestDb, runDbTests } from "./helpers/testDb.js";

// Chạy: RUN_DB_TESTS=1 DB_PASSWORD=... npm test  (cần SQL Server đang chạy)
describe.skipIf(!runDbTests)("SQL Server – lược đồ, dữ liệu mẫu, presence", () => {
  beforeAll(async () => {
    // closePool() trước: file test khác có thể đã mở pool tới CSDL sắp bị xóa.
    await closePool();
    await resetTestDb();
  }, 120_000);

  afterAll(async () => {
    await closePool();
  });

  it("chạy migration lần hai không làm gì thêm", async () => {
    expect(await migrate(() => {})).toEqual([]);
  });

  it("seed chạy lại vẫn an toàn: 10 ngôn ngữ, 1 admin + 6 khách mẫu (+6 tài khoản thử), 12 điểm × 10 bài, 160 lượt ghé", async () => {
    await seed(() => {});
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT (SELECT COUNT(*) FROM dbo.languages) AS languages, (SELECT COUNT(*) FROM dbo.users) AS users,
             (SELECT COUNT(*) FROM dbo.places) AS places, (SELECT COUNT(*) FROM dbo.place_contents) AS contents,
             (SELECT COUNT(*) FROM dbo.visits) AS visits, (SELECT COUNT(*) FROM dbo.content_releases) AS releases`);
    expect(r.recordset[0]).toEqual({ languages: 10, users: 13, places: 12, contents: 120, visits: 160, releases: 1 });
    const kinds = await pool.request().query<{ role: string; is_guest: boolean; n: number }>(
      "SELECT role, is_guest, COUNT(*) AS n FROM dbo.users WHERE email NOT LIKE '%@test.vn' GROUP BY role, is_guest ORDER BY role");
    expect(kinds.recordset).toEqual([{ role: "admin", is_guest: false, n: 1 }, { role: "user", is_guest: true, n: 6 }]);
  });

  it("5 điểm ngoài trời kích hoạt bằng GPS, 7 điểm trong nhà bằng QR; vi/en đã duyệt, 8 ngôn ngữ chờ duyệt", async () => {
    const pool = await getPool();
    const t = await pool.request().query<{ trigger_type: string; n: number }>(
      "SELECT trigger_type, COUNT(*) AS n FROM dbo.places GROUP BY trigger_type ORDER BY trigger_type",
    );
    expect(t.recordset).toEqual([{ trigger_type: "gps", n: 5 }, { trigger_type: "indoor", n: 7 }]);
    const c = await pool.request().query<{ code: string; approved: number; pending: number }>(
      "SELECT code, approved, pending FROM dbo.v_language_completeness WHERE code IN ('vi', 'ja') ORDER BY code",
    );
    expect(c.recordset).toEqual([{ code: "ja", approved: 0, pending: 12 }, { code: "vi", approved: 12, pending: 0 }]);
  });

  it("ràng buộc dữ liệu: bán kính 15–80 m, kiểu kích hoạt hợp lệ, một bài/điểm/ngôn ngữ", async () => {
    const pool = await getPool();
    const bad = (q: string) => expect(pool.request().query(q)).rejects.toThrow();
    await bad("UPDATE dbo.places SET radius_m = 5 WHERE code = '001'");
    await bad("UPDATE dbo.places SET trigger_type = 'bluetooth' WHERE code = '001'");
    await bad("UPDATE dbo.places SET code = 'A01' WHERE code = '001'");
    await bad(`INSERT INTO dbo.place_contents (place_id, language_code, title, summary, body)
               SELECT id, 'vi', N'trùng', N'trùng', N'trùng' FROM dbo.places WHERE code = '001'`);
  });

  it("giọng đọc AI: seed gắn đủ 120 tệp MP3, phát được qua /media với HTTP Range", async () => {
    const pool = await getPool();
    const r = await pool.request().query<{ n: number; secs: number }>(`
      SELECT COUNT(*) AS n, SUM(audio_duration_sec) AS secs FROM dbo.place_contents
      WHERE audio_url LIKE '/media/audio/%-ai.mp3' AND audio_bytes > 0`);
    expect(r.recordset[0]!.n).toBe(120);
    expect(r.recordset[0]!.secs).toBeGreaterThan(120 * 10);

    const app = createApp();
    const bundle = await request(app).get("/api/v1/content/bundle?lang=ja");
    const p201 = bundle.body.places.find((p: { code: string }) => p.code === "201");
    expect(p201.content).toMatchObject({ audioUrl: "/media/audio/ja/201-ai.mp3", audioDurationSec: expect.any(Number) });
    const head = await request(app).get(p201.content.audioUrl).set("Range", "bytes=0-99");
    expect(head.status).toBe(206); // tua được
    expect(head.headers["content-type"]).toMatch(/audio\/mpeg/);
  });

  it("giọng đọc AI: sửa văn bản → seed gỡ tệp cũ và tăng phiên bản; không ghi đè tệp quản trị viên tự tải", async () => {
    const pool = await getPool();
    const version = async () => (await pool.request().query<{ v: number }>("SELECT MAX(version) AS v FROM dbo.content_releases")).recordset[0]!.v;
    const audioOf = async (code: string, lang: string) => (await pool.request().query<{ audio_url: string | null }>(`
      SELECT c.audio_url FROM dbo.place_contents c JOIN dbo.places p ON p.id = c.place_id
      WHERE p.code = '${code}' AND c.language_code = '${lang}'`)).recordset[0]!.audio_url;
    const v0 = await version();
    await pool.request().query(`
      UPDATE c SET body = body + N' (đã sửa)' FROM dbo.place_contents c JOIN dbo.places p ON p.id = c.place_id
      WHERE p.code = '002' AND c.language_code = 'vi';
      UPDATE c SET audio_url = '/media/audio/ko/003-tu-thu.mp3' FROM dbo.place_contents c JOIN dbo.places p ON p.id = c.place_id
      WHERE p.code = '003' AND c.language_code = 'ko';`);
    await seed(() => {});
    expect(await audioOf("002", "vi")).toBeNull();
    expect(await audioOf("003", "ko")).toBe("/media/audio/ko/003-tu-thu.mp3");
    expect(await audioOf("002", "en")).toBe("/media/audio/en/002-ai.mp3");
    expect(await version()).toBe(v0 + 1);
    await seed(() => {}); // chạy lại không đổi gì → không tăng phiên bản
    expect(await version()).toBe(v0 + 1);
  });

  it("migration 004: không còn bảng nhóm tham quan; chỉ 2 vai trò user/admin (10 bảng)", async () => {
    const pool = await getPool();
    const tables = await pool.request().query<{ name: string }>("SELECT name FROM sys.tables ORDER BY name");
    expect(tables.recordset.map((t) => t.name)).toEqual([
      "activity_logs", "content_releases", "languages", "place_contents", "places",
      "refresh_tokens", "schema_migrations", "user_sessions", "users", "visits",
    ]);
    await expect(pool.request().query("UPDATE dbo.users SET role = 'guide' WHERE email = 'user1@test.vn'")).rejects.toThrow(/CK_users_role/);
    const proc = await pool.request().execute("dbo.sp_admin_dashboard_stats");
    expect(Object.keys(proc.recordset[0]!)).not.toContain("active_tours");
  });

  it("seed xóa tài khoản mẫu cũ (v1.x) nhưng giữ lượt ghé và nhật ký của họ", async () => {
    const pool = await getPool();
    await pool.request().query(`
      INSERT INTO dbo.users (email, password_hash, full_name, role) VALUES ('guide1@demo.vn', 'x', N'HDV cũ', 'user');
      DECLARE @u INT = SCOPE_IDENTITY();
      INSERT INTO dbo.visits (client_id, user_id, place_id, language_code, trigger_type, listened_sec, completed, started_at)
        SELECT NEWID(), @u, MIN(id), 'vi', 'qr', 30, 1, SYSUTCDATETIME() FROM dbo.places;
      INSERT INTO dbo.activity_logs (user_id, action) VALUES (@u, 'tour.create');
      INSERT INTO dbo.user_sessions (user_id, client_type) VALUES (@u, 'mobile');`);
    const before = await pool.request().query<{ v: number; l: number }>(
      "SELECT (SELECT COUNT(*) FROM dbo.visits) AS v, (SELECT COUNT(*) FROM dbo.activity_logs) AS l");
    await seed(() => {});
    const after = await pool.request().query<{ u: number; v: number; l: number; orphan: number }>(`
      SELECT (SELECT COUNT(*) FROM dbo.users WHERE email = 'guide1@demo.vn') AS u,
             (SELECT COUNT(*) FROM dbo.visits) AS v, (SELECT COUNT(*) FROM dbo.activity_logs) AS l,
             (SELECT COUNT(*) FROM dbo.activity_logs WHERE action = 'tour.create' AND user_id IS NULL) AS orphan`);
    expect(after.recordset[0]).toEqual({ u: 0, v: before.recordset[0]!.v, l: before.recordset[0]!.l, orphan: 1 });
  });

  it("đếm đúng 4 người dùng đang hoạt động (TC-30, TC-33)", async () => {
    const pool = await getPool();
    const ids = (await pool.request().query<{ id: number; email: string }>("SELECT id, email FROM dbo.users")).recordset.reduce<
      Record<string, number>
    >((m, u) => ({ ...m, [u.email]: u.id }), {});

    const add = (email: string, client: string, secondsAgo: number, disconnected = false) =>
      pool
        .request()
        .input("u", sql.Int, ids[email])
        .input("c", sql.VarChar, client)
        .input("ago", sql.Int, secondsAgo)
        .input("dc", sql.Bit, disconnected).query(`
          INSERT INTO dbo.user_sessions (user_id, client_type, last_seen_at, disconnected_at)
          VALUES (@u, @c, DATEADD(SECOND, -@ago, SYSUTCDATETIME()), CASE WHEN @dc = 1 THEN SYSUTCDATETIME() END);`);

    await add("admin@demo.vn", "admin", 0); // admin không tính
    await add("user1@test.vn", "mobile", 0);
    await add("user1@test.vn", "web", 20); // thiết bị thứ hai: không tính thêm
    await add("user2@test.vn", "mobile", 10);
    await add("user3@test.vn", "mobile", 0);
    await add("user4@test.vn", "web", 45);
    await add("user5@test.vn", "mobile", 120); // mất mạng: nhịp tim quá 60 giây
    await add("user6@test.vn", "mobile", 0, true); // đã thoát

    const active = await pool.request().query<{ n: number }>("SELECT COUNT(*) AS n FROM dbo.v_active_users WHERE role <> 'admin'");
    expect(active.recordset[0]!.n).toBe(4);

    const stats = await pool.request().execute<{ total_users: number; active_users: number; published_places: number; pending_contents: number }>(
      "dbo.sp_admin_dashboard_stats",
    );
    // total_users: 6 khách mẫu + 6 tài khoản thử (admin không tính)
    expect(stats.recordset[0]).toMatchObject({ total_users: 12, active_users: 4, published_places: 12, pending_contents: 96 });
  });

  it("GET /health/ready báo đã kết nối CSDL và 4 migration", async () => {
    const res = await request(createApp()).get("/health/ready");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ready", database: "ok", migrations: 4 });
  });
});
