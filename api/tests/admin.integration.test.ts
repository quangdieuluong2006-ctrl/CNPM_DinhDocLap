import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { closePool } from "../src/db/pool.js";
import { bearer, loginAs, SEED_PASSWORD } from "./helpers/http.js";
import { resetTestDb, runDbTests } from "./helpers/testDb.js";

// Web Admin: điểm, bài, âm thanh, ngôn ngữ, người dùng, nhật ký (PRD v1.0, FE-18, FE-20 → FE-24).
const app = createApp();
const api = (path: string) => `/api/v1${path}`;
const newPlace = {
  code: "301", slug: "phong-thu-nghiem", internalName: "Phòng thử nghiệm", trigger: "gps", zone: "outdoor",
  lat: 10.7782, lng: 106.695, radiusM: 25, status: "published",
};

describe.skipIf(!runDbTests)("API quản trị trên SQL Server", () => {
  let admin: Record<string, string>;
  let placeId: number;

  beforeAll(async () => {
    await closePool();
    await resetTestDb();
    admin = bearer(await loginAs(app, "admin@demo.vn"));
  }, 120_000);
  afterAll(closePool);

  it("người dùng thường và hướng dẫn viên không vào được API quản trị", async () => {
    for (const email of ["user1@demo.vn", "guide1@demo.vn"]) {
      const res = await request(app).get(api("/admin/places")).set(bearer(await loginAs(app, email)));
      expect(res.status).toBe(403);
    }
  });

  it("thêm điểm: trùng số điểm → 409; tọa độ trùng vùng điểm khác → cảnh báo; phiên bản nội dung tăng", async () => {
    const v0 = (await request(app).get(api("/content/version"))).body.version as number;
    const dup = await request(app).post(api("/admin/places")).set(admin).send({ ...newPlace, code: "001" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("PLACE_CODE_TAKEN");
    expect((await request(app).post(api("/admin/places")).set(admin).send({ ...newPlace, radiusM: 100 })).status).toBe(400);

    const { body: list } = await request(app).get(api("/admin/places")).set(admin);
    const p001 = list.items.find((p: { code: string }) => p.code === "001");
    const res = await request(app).post(api("/admin/places")).set(admin).send({ ...newPlace, lat: p001.lat, lng: p001.lng + 0.0001 });
    expect(res.status).toBe(201);
    expect(res.body.warnings.map((w: { code: string }) => w.code)).toContain("001");
    expect(res.body.version).toBe(v0 + 1);
    placeId = res.body.place.id;

    const fixed = await request(app).patch(api(`/admin/places/${placeId}`)).set(admin).send({ lat: newPlace.lat, lng: newPlace.lng });
    expect(fixed.status).toBe(200);
    // PATCH chỉ đổi trường được gửi, không làm điểm đang xuất bản quay về nháp
    expect(fixed.body.place).toMatchObject({ code: "301", lat: newPlace.lat, radiusM: 25, status: "published" });
    expect(fixed.body.warnings).toEqual([]);
  });

  it("bài theo ngôn ngữ: nháp không hiện cho khách, chờ duyệt hiện kèm nhãn", async () => {
    const draft = { title: "Phòng thử", summary: "Tóm tắt", body: "Nội dung thử nghiệm.", status: "draft" };
    expect((await request(app).put(api(`/admin/places/${placeId}/contents/vi`)).set(admin).send(draft)).status).toBe(201);
    const hidden = await request(app).get(api("/places/301?lang=vi"));
    expect(hidden.status).toBe(200);
    expect(hidden.body.content).toBeNull();

    const pending = await request(app).put(api(`/admin/places/${placeId}/contents/vi`)).set(admin).send({ ...draft, status: "pending" });
    expect(pending.status).toBe(200);
    expect(pending.body.content).toMatchObject({ lang: "vi", status: "pending", updatedBy: { fullName: expect.any(String) } });
    expect((await request(app).get(api("/places/301?lang=vi"))).body.content).toMatchObject({ status: "pending" });

    const noLang = await request(app).put(api(`/admin/places/${placeId}/contents/it`)).set(admin).send(draft);
    expect(noLang.status).toBe(400);
    const detail = await request(app).get(api(`/admin/places/${placeId}`)).set(admin);
    expect(detail.body.contents).toHaveLength(1);
  });

  it("tải âm thanh: lưu tệp, phát được qua /media có hỗ trợ tua (Range); sai định dạng 415; quá lớn 413", async () => {
    const audio = Buffer.alloc(4096, 7);
    const up = await request(app).post(api(`/admin/places/${placeId}/contents/vi/audio`)).set(admin)
      .field("durationSec", "95").attach("file", audio, { filename: "thu.mp3", contentType: "audio/mpeg" });
    expect(up.status).toBe(201);
    const url = up.body.content.audioUrl as string;
    expect(url).toMatch(/^\/media\/audio\/vi\/301-\d+-[0-9a-f]{6}\.mp3$/);
    expect(up.body.content).toMatchObject({ audioDurationSec: 95, audioBytes: 4096 });

    const part = await request(app).get(url).set("Range", "bytes=0-99");
    expect(part.status).toBe(206);
    expect(part.headers["content-length"]).toBe("100");

    const bundle = await request(app).get(api("/content/bundle?lang=vi"));
    expect(bundle.body.places.find((p: { code: string }) => p.code === "301").content.audioUrl).toBe(url);

    const wrong = await request(app).post(api(`/admin/places/${placeId}/contents/vi/audio`)).set(admin)
      .attach("file", Buffer.from("x"), { filename: "a.txt", contentType: "text/plain" });
    expect(wrong.status).toBe(415);
    const big = await request(app).post(api(`/admin/places/${placeId}/contents/vi/audio`)).set(admin)
      .attach("file", Buffer.alloc(1024 * 1024 + 1), { filename: "big.mp3", contentType: "audio/mpeg" });
    expect(big.status).toBe(413);
    expect(big.body.error.code).toBe("FILE_TOO_LARGE");

    expect((await request(app).delete(api(`/admin/places/${placeId}/contents/vi/audio`)).set(admin)).status).toBe(204);
    expect((await request(app).get(url)).status).toBe(404);
  });

  it("xóa điểm: đã có lượt ghé → 409 PLACE_HAS_VISITS; chưa có → xóa được", async () => {
    const visit = { clientId: randomUUID(), placeId: 1, lang: "vi", trigger: "gps", startedAt: new Date().toISOString() };
    await request(app).post(api("/visits")).send(visit);
    const blocked = await request(app).delete(api("/admin/places/1")).set(admin);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("PLACE_HAS_VISITS");
    expect((await request(app).delete(api(`/admin/places/${placeId}`)).set(admin)).status).toBe(204);
    expect((await request(app).get(api(`/admin/places/${placeId}`)).set(admin)).status).toBe(404);
  });

  it("ngôn ngữ: tìm trong danh mục ISO, thêm tiếng Ý, viết bài → khách thấy tiếng Ý (AC FE-22)", async () => {
    const cat = await request(app).get(api("/admin/languages/catalog?q=italiano")).set(admin);
    expect(cat.body.items).toEqual([expect.objectContaining({ code: "it", nameVi: "Tiếng Italy", ttsLocale: "it-IT", added: false })]);
    expect((await request(app).get(api("/admin/languages/catalog")).set(admin)).body.items.length).toBeGreaterThan(180);

    const add = await request(app).put(api("/admin/languages/it")).set(admin).send({});
    expect(add.status).toBe(201);
    expect(add.body).toMatchObject({ code: "it", nameNative: "Italiano", isEnabled: true, completeness: 0 });
    expect((await request(app).get(api("/languages"))).body.items.map((l: { code: string }) => l.code)).not.toContain("it");

    const content = { title: "Cancello principale", summary: "Inizio del percorso", body: "Benvenuti.", status: "approved" };
    await request(app).put(api("/admin/places/1/contents/it")).set(admin).send(content);
    expect((await request(app).get(api("/languages"))).body.items.map((l: { code: string }) => l.code)).toContain("it");

    const off = await request(app).put(api("/admin/languages/it")).set(admin).send({ isEnabled: false });
    expect(off.body.isEnabled).toBe(false);
    expect((await request(app).put(api("/admin/languages/vi")).set(admin).send({ isEnabled: false })).status).toBe(409);
    expect((await request(app).put(api("/admin/languages/qq")).set(admin).send({})).status).toBe(400);
  });

  it("người dùng: lọc, khóa (không đăng nhập được, refresh bị thu hồi), mở khóa, đổi vai trò", async () => {
    const list = await request(app).get(api("/admin/users?role=user&pageSize=4")).set(admin);
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({ page: 1, pageSize: 4, total: 6 });
    expect(list.body.items).toHaveLength(4);
    expect(list.body.items[0]).toHaveProperty("lastSeenAt");

    const login = await request(app).post(api("/auth/login")).send({ email: "user6@demo.vn", password: SEED_PASSWORD, clientType: "mobile" });
    const user6 = login.body.user.id as number;
    const lock = await request(app).patch(api(`/admin/users/${user6}`)).set(admin).send({ status: "locked", reason: "Spam" });
    expect(lock.status).toBe(200);
    expect(lock.body).toMatchObject({ status: "locked", lockedReason: "Spam" });
    const again = await request(app).post(api("/auth/login")).send({ email: "user6@demo.vn", password: SEED_PASSWORD, clientType: "mobile" });
    expect(again.body.error.code).toBe("ACCOUNT_LOCKED");
    const refresh = await request(app).post(api("/auth/refresh")).send({ clientType: "mobile", refreshToken: login.body.refreshToken });
    expect(refresh.status).toBe(401);

    expect((await request(app).patch(api(`/admin/users/${user6}`)).set(admin).send({ status: "locked" })).status).toBe(400);
    expect((await request(app).patch(api(`/admin/users/${user6}`)).set(admin).send({ status: "active" })).body.status).toBe("active");
    expect((await request(app).patch(api(`/admin/users/${user6}`)).set(admin).send({ role: "guide" })).body.role).toBe("guide");

    const detail = await request(app).get(api(`/admin/users/${user6}`)).set(admin);
    expect(detail.body.user).toMatchObject({ role: "guide", online: false });
    expect(Array.isArray(detail.body.sessions)).toBe(true);

    const self = (await request(app).get(api("/me")).set(admin)).body.id as number;
    const selfLock = await request(app).patch(api(`/admin/users/${self}`)).set(admin).send({ role: "user" });
    expect(selfLock.body.error.code).toBe("CANNOT_MODIFY_SELF");
  });

  it("nhật ký hoạt động lọc theo nhóm hành động; danh sách nhóm tham quan", async () => {
    const logs = await request(app).get(api("/admin/activity-logs?action=admin.user")).set(admin);
    expect(logs.status).toBe(200);
    expect(logs.body.items.map((l: { action: string }) => l.action)).toEqual(
      expect.arrayContaining(["admin.user.lock", "admin.user.unlock", "admin.user.role_change"]));
    expect(logs.body.items[0].user.email).toBe("admin@demo.vn");
    const place = await request(app).get(api("/admin/activity-logs?action=place&pageSize=100")).set(admin);
    expect(place.body.items.every((l: { action: string }) => l.action.startsWith("place."))).toBe(true);
    expect((await request(app).get(api("/admin/tours?status=active")).set(admin)).status).toBe(200);
  });
});
