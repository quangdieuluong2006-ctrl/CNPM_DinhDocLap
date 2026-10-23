import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../../lib/apiError.js";
import { overlapWarnings } from "../../lib/geo.js";
import { removeMedia, saveMedia, uploadAudio, uploadImage } from "../../lib/media.js";
import { currentUser } from "../../middlewares/auth.js";
import { emitTo } from "../../realtime/hub.js";
import { logActivity } from "../activity/activity.service.js";
import { getLanguage } from "../content/content.repository.js";
import { langSchema, placeCodeSchema, ZONES } from "../content/content.schemas.js";
import * as repo from "./places.repository.js";

// Quản lý điểm thuyết minh, bài theo ngôn ngữ, âm thanh, ảnh (PRD v1.0, FE-20, FE-21).
// Router này được gắn sau requireAuth + requireRole("admin") của adminRouter.
export const adminPlacesRouter = Router();

const idParam = z.coerce.number().int().positive();

// Không đặt default ở đây: PATCH dùng .partial() và default sẽ ghi đè giá trị hiện có (ví dụ status → draft).
const placeFields = z.object({
  code: placeCodeSchema,
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Chỉ gồm chữ thường không dấu, số và dấu gạch ngang").max(80),
  internalName: z.string().trim().min(1).max(120),
  trigger: z.enum(["gps", "indoor"]),
  zone: z.enum(ZONES),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().int().min(15).max(80),
  priority: z.number().int().min(-100).max(100),
  sortOrder: z.number().int().min(0).max(100_000),
  status: z.enum(["draft", "published", "hidden"]),
});
const placeSchema = placeFields.extend({
  radiusM: placeFields.shape.radiusM.default(25),
  priority: placeFields.shape.priority.default(0),
  sortOrder: placeFields.shape.sortOrder.default(0),
  status: placeFields.shape.status.default("draft"),
});

function toAdminPlaceDto(p: repo.AdminPlaceRow) {
  return {
    id: p.id,
    code: p.code,
    slug: p.slug,
    internalName: p.internal_name,
    trigger: p.trigger_type,
    zone: p.zone,
    lat: Number(p.lat),
    lng: Number(p.lng),
    radiusM: p.radius_m,
    priority: p.priority,
    sortOrder: p.sort_order,
    imageUrl: p.image_url,
    status: p.status,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    visits: p.visits,
    contents: { approved: p.approved, pending: p.pending, draft: p.draft, withAudio: p.audio_count },
  };
}

function toContentDto(c: repo.ContentRow) {
  return {
    lang: c.language_code,
    title: c.title,
    summary: c.summary,
    body: c.body,
    status: c.status,
    source: c.source,
    audioUrl: c.audio_url,
    audioDurationSec: c.audio_duration_sec,
    audioBytes: c.audio_bytes,
    updatedBy: c.updated_by ? { id: c.updated_by, fullName: c.updated_by_name } : null,
    updatedAt: c.updated_at,
  };
}

async function placeOr404(id: number): Promise<repo.AdminPlaceRow> {
  const p = await repo.findPlace(id);
  if (!p) throw new ApiError(404, "PLACE_NOT_FOUND", "Không tìm thấy điểm thuyết minh");
  return p;
}

// Mọi thay đổi làm tăng phiên bản nội dung để ứng dụng tải gói mới (PRD v1.0, mục 7, SD-03).
async function publish(userId: number, note: string): Promise<number> {
  const version = await repo.publishRelease(userId, note);
  emitTo("admins", "admin.content.published", { version });
  return version;
}

async function warningsFor(p: z.infer<typeof placeSchema>, id: number | null) {
  return p.trigger === "gps" && p.status !== "hidden" ? overlapWarnings(p, await repo.otherGpsPlaces(id)) : [];
}

adminPlacesRouter.get("/admin/places", async (req, res) => {
  const q = z.object({
    status: z.enum(["draft", "published", "hidden"]).optional(),
    zone: z.enum(ZONES).optional(),
    q: z.string().trim().max(100).optional(),
  }).parse(req.query);
  const rows = await repo.listPlaces({ status: q.status, zone: q.zone, q: q.q || undefined });
  res.json({ items: rows.map(toAdminPlaceDto) });
});

adminPlacesRouter.post("/admin/places", async (req, res) => {
  const { sub } = currentUser(res.locals);
  const input = placeSchema.parse(req.body);
  const id = await repo.insertPlace(input);
  const version = await publish(sub, `Thêm điểm ${input.code}`);
  await logActivity({ userId: sub, action: "place.create", entityType: "place", entityId: id, ip: req.ip, detail: { code: input.code } });
  res.status(201).json({ place: toAdminPlaceDto((await repo.findPlace(id))!), warnings: await warningsFor(input, id), version });
});

adminPlacesRouter.get("/admin/places/:id", async (req, res) => {
  const place = await placeOr404(idParam.parse(req.params.id));
  res.json({ place: toAdminPlaceDto(place), contents: (await repo.listContents(place.id)).map(toContentDto) });
});

// PATCH nhận một phần trường; ghép với bản hiện tại rồi kiểm tra lại toàn bộ.
adminPlacesRouter.patch("/admin/places/:id", async (req, res) => {
  const { sub } = currentUser(res.locals);
  const current = await placeOr404(idParam.parse(req.params.id));
  const patch = placeFields.partial().parse(req.body);
  const merged = placeSchema.parse({ ...toAdminPlaceDto(current), ...patch });
  await repo.updatePlace(current.id, merged);
  const version = await publish(sub, `Sửa điểm ${merged.code}`);
  await logActivity({ userId: sub, action: "place.update", entityType: "place", entityId: current.id, ip: req.ip, detail: { changed: Object.keys(patch) } });
  res.json({ place: toAdminPlaceDto((await repo.findPlace(current.id))!), warnings: await warningsFor(merged, current.id), version });
});

adminPlacesRouter.delete("/admin/places/:id", async (req, res) => {
  const { sub } = currentUser(res.locals);
  const id = idParam.parse(req.params.id);
  const place = await placeOr404(id);
  const contents = await repo.listContents(id);
  const result = await repo.deletePlace(id);
  if (result === "not_found") throw new ApiError(404, "PLACE_NOT_FOUND", "Không tìm thấy điểm thuyết minh");
  if (result === "has_visits") throw new ApiError(409, "PLACE_HAS_VISITS", "Điểm đã có lượt ghé nên không xóa được, hãy chuyển sang trạng thái ẩn");
  await Promise.all([removeMedia(place.image_url), ...contents.map((c) => removeMedia(c.audio_url))]);
  await publish(sub, `Xóa điểm ${place.code}`);
  await logActivity({ userId: sub, action: "place.delete", entityType: "place", entityId: id, ip: req.ip, detail: { code: place.code } });
  res.status(204).end();
});

async function languageOr400(code: string): Promise<void> {
  if (!(await getLanguage(code))) {
    throw new ApiError(400, "VALIDATION_ERROR", `Ngôn ngữ "${code}" chưa được thêm vào hệ thống`, {
      fields: [{ path: ["lang"], message: "Thêm ngôn ngữ ở mục Quản lý ngôn ngữ trước" }],
    });
  }
}

const contentSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(5000),
  status: z.enum(["draft", "pending", "approved"]).default("draft"),
  source: z.enum(["human", "machine"]).default("human"),
});

adminPlacesRouter.put("/admin/places/:id/contents/:lang", async (req, res) => {
  const { sub } = currentUser(res.locals);
  const place = await placeOr404(idParam.parse(req.params.id));
  const lang = langSchema.parse(req.params.lang);
  await languageOr400(lang);
  const input = contentSchema.parse(req.body);
  const action = await repo.upsertContent(place.id, lang, input, sub);
  const version = await publish(sub, `Bài ${place.code}/${lang}: ${input.status}`);
  await logActivity({ userId: sub, action: "place.content.update", entityType: "place", entityId: place.id, ip: req.ip, detail: { lang, status: input.status, action } });
  res.status(action === "created" ? 201 : 200).json({ content: toContentDto((await repo.findContent(place.id, lang))!), version });
});

adminPlacesRouter.delete("/admin/places/:id/contents/:lang", async (req, res) => {
  const { sub } = currentUser(res.locals);
  const place = await placeOr404(idParam.parse(req.params.id));
  const lang = langSchema.parse(req.params.lang);
  const content = await repo.findContent(place.id, lang);
  if (!content || !(await repo.deleteContent(place.id, lang))) throw new ApiError(404, "NOT_FOUND", "Điểm chưa có bài ngôn ngữ này");
  await removeMedia(content.audio_url);
  await publish(sub, `Xóa bài ${place.code}/${lang}`);
  await logActivity({ userId: sub, action: "place.content.update", entityType: "place", entityId: place.id, ip: req.ip, detail: { lang, action: "deleted" } });
  res.status(204).end();
});

// multipart/form-data: file (âm thanh) + durationSec (trình duyệt đo được từ thẻ <audio>, không bắt buộc).
adminPlacesRouter.post("/admin/places/:id/contents/:lang/audio", uploadAudio, async (req, res) => {
  const { sub } = currentUser(res.locals);
  const place = await placeOr404(idParam.parse(req.params.id));
  const lang = langSchema.parse(req.params.lang);
  const content = await repo.findContent(place.id, lang);
  if (!content) throw new ApiError(404, "NOT_FOUND", "Hãy lưu bài thuyết minh ngôn ngữ này trước khi tải âm thanh");
  const { durationSec } = z.object({ durationSec: z.coerce.number().int().min(1).max(3 * 3600).optional() }).parse(req.body ?? {});
  const url = await saveMedia(req.file, `audio/${lang}`, place.code);
  await repo.setContentAudio(place.id, lang, { url, durationSec: durationSec ?? null, bytes: req.file!.size }, sub);
  await removeMedia(content.audio_url);
  const version = await publish(sub, `Âm thanh ${place.code}/${lang}`);
  await logActivity({ userId: sub, action: "place.audio.upload", entityType: "place", entityId: place.id, ip: req.ip, detail: { lang, bytes: req.file!.size } });
  res.status(201).json({ content: toContentDto((await repo.findContent(place.id, lang))!), version });
});

adminPlacesRouter.delete("/admin/places/:id/contents/:lang/audio", async (req, res) => {
  const { sub } = currentUser(res.locals);
  const place = await placeOr404(idParam.parse(req.params.id));
  const lang = langSchema.parse(req.params.lang);
  const content = await repo.findContent(place.id, lang);
  if (!content?.audio_url) throw new ApiError(404, "NOT_FOUND", "Bài này chưa có tệp âm thanh");
  await repo.setContentAudio(place.id, lang, null, sub);
  await removeMedia(content.audio_url);
  await publish(sub, `Xóa âm thanh ${place.code}/${lang}`);
  await logActivity({ userId: sub, action: "place.audio.upload", entityType: "place", entityId: place.id, ip: req.ip, detail: { lang, action: "deleted" } });
  res.status(204).end();
});

adminPlacesRouter.post("/admin/places/:id/image", uploadImage, async (req, res) => {
  const { sub } = currentUser(res.locals);
  const place = await placeOr404(idParam.parse(req.params.id));
  const url = await saveMedia(req.file, "images", place.code);
  await repo.setPlaceImage(place.id, url);
  await removeMedia(place.image_url);
  const version = await publish(sub, `Ảnh điểm ${place.code}`);
  await logActivity({ userId: sub, action: "place.update", entityType: "place", entityId: place.id, ip: req.ip, detail: { image: true } });
  res.status(201).json({ place: toAdminPlaceDto((await repo.findPlace(place.id))!), version });
});
