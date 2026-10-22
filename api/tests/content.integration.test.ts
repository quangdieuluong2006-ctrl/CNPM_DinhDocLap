import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { closePool, getPool } from "../src/db/pool.js";
import { bearer, loginAs } from "./helpers/http.js";
import { resetTestDb, runDbTests } from "./helpers/testDb.js";

// API nội dung công khai, lượt ghé, hồ sơ (PRD v1.0, mục 11.2). Chạy: RUN_DB_TESTS=1 npm test
const app = createApp();
const api = (path: string) => `/api/v1${path}`;

describe.skipIf(!runDbTests)("Nội dung công khai và lượt ghé trên SQL Server", () => {
  beforeAll(async () => {
    await closePool();
    await resetTestDb();
  }, 120_000);
  afterAll(closePool);

  it("GET /languages: 10 ngôn ngữ đã bật, có mức hoàn thiện", async () => {
    const res = await request(app).get(api("/languages"));
    expect(res.status).toBe(200);
    const items = res.body.items as { code: string; nameNative: string; completeness: number; pending: number }[];
    expect(items).toHaveLength(10);
    expect(items[0]).toMatchObject({ code: "vi", completeness: 100 });
    expect(items.find((l) => l.code === "ja")).toMatchObject({ nameNative: "日本語", completeness: 0, pending: 12 });
  });

  it("GET /places: 12 điểm đã xuất bản, không trả body; lọc theo khu vực và từ khóa", async () => {
    const all = await request(app).get(api("/places?lang=vi"));
    expect(all.status).toBe(200);
    expect(all.body.items).toHaveLength(12);
    expect(all.body.items[0].content.body).toBeUndefined();
    expect(all.body.items.filter((p: { trigger: string }) => p.trigger === "gps")).toHaveLength(5);

    const outdoor = await request(app).get(api("/places?lang=vi&zone=outdoor"));
    expect(outdoor.body.items.every((p: { zone: string }) => p.zone === "outdoor")).toBe(true);

    const byCode = await request(app).get(api("/places?q=201"));
    expect(byCode.body.items.map((p: { code: string }) => p.code)).toEqual(["201"]);

    expect((await request(app).get(api("/places?zone=moon"))).status).toBe(400);
  });

  it("ngôn ngữ có bài chờ duyệt → trả bài kèm status; ngôn ngữ chưa có bài → dự phòng tiếng Anh", async () => {
    const ko = await request(app).get(api("/places?lang=ko"));
    expect(ko.body.items[0].content).toMatchObject({ lang: "ko", status: "pending", isFallback: false });
    const it_ = await request(app).get(api("/places?lang=it"));
    expect(it_.body.items[0].content).toMatchObject({ lang: "en", isFallback: true });
  });

  it("GET /places/{code}: bài đầy đủ + danh sách ngôn ngữ; số điểm sai → 400, không có → 404", async () => {
    const res = await request(app).get(api("/places/002?lang=en"));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ code: "002", trigger: "gps", content: { lang: "en", status: "approved" } });
    expect(res.body.content.body.length).toBeGreaterThan(100);
    expect(res.body.languages).toHaveLength(10);
    expect((await request(app).get(api("/places/2"))).status).toBe(400);
    const missing = await request(app).get(api("/places/999"));
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("PLACE_NOT_FOUND");
  });

  it("GET /content/bundle: ETag theo phiên bản, gọi lại với If-None-Match → 304", async () => {
    const v = await request(app).get(api("/content/version"));
    expect(v.body.version).toBe(1);
    const res = await request(app).get(api("/content/bundle?lang=ja"));
    expect(res.status).toBe(200);
    expect(res.headers.etag).toBe('"v1-ja"');
    expect(res.body).toMatchObject({ version: 1, lang: "ja", ttsLocale: "ja-JP" });
    expect(res.body.places).toHaveLength(12);
    expect(res.body.places[0].content.body).toBeTruthy();
    const again = await request(app).get(api("/content/bundle?lang=ja")).set("If-None-Match", '"v1-ja"');
    expect(again.status).toBe(304);
  });

  it("POST /visits: khách không đăng nhập được ghi; gửi lại cùng clientId không bị trùng", async () => {
    const pool = await getPool();
    const before = (await pool.request().query<{ n: number }>("SELECT COUNT(*) AS n FROM dbo.visits")).recordset[0]!.n;
    const visit = { clientId: randomUUID(), placeId: 1, lang: "en", trigger: "gps", listenedSec: 60, completed: true, startedAt: new Date().toISOString() };
    const first = await request(app).post(api("/visits")).send(visit);
    expect(first.status).toBe(201);
    expect(first.body.result).toBe("accepted");
    const dup = await request(app).post(api("/visits")).send(visit);
    expect(dup.status).toBe(200);
    expect(dup.body.result).toBe("duplicate");
    const after = (await pool.request().query<{ n: number }>("SELECT COUNT(*) AS n FROM dbo.visits")).recordset[0]!.n;
    expect(after).toBe(before + 1);
  });

  it("POST /visits: điểm không tồn tại → 404; thời điểm ở tương lai → 400; token sai → 401", async () => {
    const base = { clientId: randomUUID(), placeId: 9999, lang: "en", trigger: "qr", startedAt: new Date().toISOString() };
    expect((await request(app).post(api("/visits")).send(base)).status).toBe(404);
    const future = { ...base, placeId: 1, startedAt: new Date(Date.now() + 3600_000).toISOString() };
    expect((await request(app).post(api("/visits")).send(future)).status).toBe(400);
    expect((await request(app).post(api("/visits")).set(bearer("sai")).send({ ...base, placeId: 1 })).status).toBe(401);
  });

  it("POST /visits/batch (đồng bộ sau offline) + GET /me/visits", async () => {
    const token = await loginAs(app, "user6@demo.vn");
    const at = (minAgo: number) => new Date(Date.now() - minAgo * 60_000).toISOString();
    const dupId = randomUUID();
    const visits = [
      { clientId: dupId, placeId: 2, lang: "ja", trigger: "gps", listenedSec: 90, completed: true, startedAt: at(30) },
      { clientId: dupId, placeId: 2, lang: "ja", trigger: "gps", listenedSec: 90, completed: true, startedAt: at(30) },
      { clientId: randomUUID(), placeId: 6, lang: "ja", trigger: "code", listenedSec: 10, completed: false, startedAt: at(20) },
      { clientId: "khong-phai-uuid", placeId: 6, lang: "ja", trigger: "code", startedAt: at(10) },
    ];
    const res = await request(app).post(api("/visits/batch")).set(bearer(token)).send({ visits });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ accepted: 2, duplicates: 1, rejected: 1, errors: [{ index: 3, code: "VALIDATION_ERROR" }] });

    const mine = await request(app).get(api("/me/visits?pageSize=1")).set(bearer(token));
    expect(mine.status).toBe(200);
    expect(mine.body.total).toBeGreaterThanOrEqual(2);
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0]).toMatchObject({ placeId: 6, lang: "ja", trigger: "code" });
    expect(mine.body.items[0].title).toBeTruthy();
  });

  it("PATCH /me: đổi ngôn ngữ thuyết minh; ngôn ngữ chưa có → 400", async () => {
    const token = await loginAs(app, "user5@demo.vn");
    const ok = await request(app).patch(api("/me")).set(bearer(token)).send({ narrationLang: "ko", uiLocale: "en" });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ narrationLang: "ko", uiLocale: "en" });
    const bad = await request(app).patch(api("/me")).set(bearer(token)).send({ narrationLang: "it" });
    expect(bad.status).toBe(400);
    expect((await request(app).patch(api("/me")).set(bearer(token)).send({})).status).toBe(400);
  });
});
