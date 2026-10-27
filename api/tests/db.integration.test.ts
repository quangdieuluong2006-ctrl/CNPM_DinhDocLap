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

  it("seed chạy lại vẫn an toàn: 10 ngôn ngữ, 9 tài khoản, 12 điểm × 10 bài, 160 lượt ghé", async () => {
    await seed(() => {});
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT (SELECT COUNT(*) FROM dbo.languages) AS languages, (SELECT COUNT(*) FROM dbo.users) AS users,
             (SELECT COUNT(*) FROM dbo.places) AS places, (SELECT COUNT(*) FROM dbo.place_contents) AS contents,
             (SELECT COUNT(*) FROM dbo.visits) AS visits, (SELECT COUNT(*) FROM dbo.content_releases) AS releases`);
    expect(r.recordset[0]).toEqual({ languages: 10, users: 9, places: 12, contents: 120, visits: 160, releases: 1 });
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

  it("một người chỉ ở một nhóm tham quan chưa rời", async () => {
    const pool = await getPool();
    await pool.request().query(`
      DECLARE @guide INT = (SELECT id FROM dbo.users WHERE email = 'guide1@demo.vn');
      DECLARE @u INT = (SELECT id FROM dbo.users WHERE email = 'user1@demo.vn');
      INSERT INTO dbo.tours (code, name, guide_id) VALUES ('TEST01', N'Nhóm A', @guide), ('TEST02', N'Nhóm B', @guide);
      INSERT INTO dbo.tour_members (tour_id, user_id) SELECT id, @u FROM dbo.tours WHERE code = 'TEST01';`);
    await expect(
      pool.request().query(`
        INSERT INTO dbo.tour_members (tour_id, user_id)
        SELECT t.id, u.id FROM dbo.tours t, dbo.users u WHERE t.code = 'TEST02' AND u.email = 'user1@demo.vn'`),
    ).rejects.toThrow();
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
    await add("user1@demo.vn", "mobile", 0);
    await add("user1@demo.vn", "web", 20); // thiết bị thứ hai: không tính thêm
    await add("user2@demo.vn", "mobile", 10);
    await add("guide1@demo.vn", "mobile", 0); // hướng dẫn viên có tính
    await add("user4@demo.vn", "web", 45);
    await add("user5@demo.vn", "mobile", 120); // mất mạng: nhịp tim quá 60 giây
    await add("user6@demo.vn", "mobile", 0, true); // đã thoát

    const active = await pool.request().query<{ n: number }>("SELECT COUNT(*) AS n FROM dbo.v_active_users WHERE role <> 'admin'");
    expect(active.recordset[0]!.n).toBe(4);

    const stats = await pool.request().execute<{ total_users: number; active_users: number; published_places: number; pending_contents: number }>(
      "dbo.sp_admin_dashboard_stats",
    );
    expect(stats.recordset[0]).toMatchObject({ total_users: 8, active_users: 4, published_places: 12, pending_contents: 96 });
  });

  it("GET /health/ready báo đã kết nối CSDL và 3 migration", async () => {
    const res = await request(createApp()).get("/health/ready");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ready", database: "ok", migrations: 3 });
  });
});
