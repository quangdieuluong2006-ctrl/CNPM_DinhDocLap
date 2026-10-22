import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../../lib/apiError.js";
import { offsetOf, pageQuery } from "../../lib/pagination.js";
import { currentUser } from "../../middlewares/auth.js";
import { disconnectUser, emitTo } from "../../realtime/hub.js";
import { logActivity } from "../activity/activity.service.js";
import { langSchema } from "../content/content.schemas.js";
import { listTours } from "../tours/tours.repository.js";
import { toTourDto } from "../tours/tours.service.js";
import { catalogEntry, searchCatalog } from "./languageCatalog.js";
import * as repo from "./management.repository.js";
import { publishRelease } from "./places.repository.js";

// Quản lý ngôn ngữ, người dùng, nhóm tham quan, nhật ký (PRD v1.0, FE-18, FE-22, FE-23, FE-24).
// Gắn sau requireAuth + requireRole("admin") của adminRouter.
export const adminManagementRouter = Router();

const idParam = z.coerce.number().int().positive();
// Tiếng Việt và tiếng Anh là ngôn ngữ dự phòng (chọn → en → vi) nên không được tắt.
const FALLBACK_LANGS = new Set(["vi", "en"]);

function toAdminLanguageDto(l: repo.AdminLanguageRow) {
  return {
    code: l.code,
    nameVi: l.name_vi,
    nameEn: l.name_en,
    nameNative: l.name_native,
    ttsLocale: l.tts_locale,
    isEnabled: l.is_enabled,
    sortOrder: l.sort_order,
    publishedPlaces: l.published_places,
    approved: l.approved,
    pending: l.pending,
    draft: l.draft,
    completeness: l.published_places > 0 ? Math.round((l.approved * 100) / l.published_places) : 0,
  };
}

adminManagementRouter.get("/admin/languages", async (_req, res) => {
  res.json({ items: (await repo.listLanguages()).map(toAdminLanguageDto) });
});

// Danh mục ~180 ngôn ngữ ISO 639-1 có tìm kiếm (gõ "nhat", "japanese", "日本" hoặc "ja").
adminManagementRouter.get("/admin/languages/catalog", async (req, res) => {
  const { q } = z.object({ q: z.string().trim().max(60).optional() }).parse(req.query);
  const added = new Set((await repo.listLanguages()).map((l) => l.code));
  res.json({ items: searchCatalog(q).map((l) => ({ ...l, added: added.has(l.code) })) });
});

const languageSchema = z.object({
  nameVi: z.string().trim().min(1).max(60).optional(),
  nameEn: z.string().trim().min(1).max(60).optional(),
  nameNative: z.string().trim().min(1).max(60).optional(),
  ttsLocale: z.string().trim().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, "Mã BCP 47, ví dụ ja-JP").optional(),
  isEnabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

// Thêm (từ danh mục) hoặc sửa/bật/tắt một ngôn ngữ. Trường không gửi lấy từ bản hiện có hoặc từ danh mục.
adminManagementRouter.put("/admin/languages/:code", async (req, res) => {
  const { sub } = currentUser(res.locals);
  const code = langSchema.parse(req.params.code);
  const input = languageSchema.parse(req.body ?? {});
  const existing = (await repo.listLanguages()).find((l) => l.code === code);
  const catalog = catalogEntry(code);
  if (!existing && !catalog && !(input.nameVi && input.nameEn && input.nameNative && input.ttsLocale)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Mã ngôn ngữ không có trong danh mục ISO 639-1, cần nhập đủ tên và ttsLocale");
  }
  if (input.isEnabled === false && FALLBACK_LANGS.has(code)) {
    throw new ApiError(409, "LANGUAGE_REQUIRED", "Tiếng Việt và tiếng Anh là ngôn ngữ dự phòng, không thể tắt");
  }
  const action = await repo.upsertLanguage({
    code,
    nameVi: input.nameVi ?? existing?.name_vi ?? catalog!.nameVi,
    nameEn: input.nameEn ?? existing?.name_en ?? catalog!.nameEn,
    nameNative: input.nameNative ?? existing?.name_native ?? catalog!.nameNative,
    ttsLocale: input.ttsLocale ?? existing?.tts_locale ?? catalog!.ttsLocale,
    isEnabled: input.isEnabled ?? existing?.is_enabled ?? true,
    sortOrder: input.sortOrder ?? existing?.sort_order ?? 100,
  });
  const version = await publishRelease(sub, `Ngôn ngữ ${code}`);
  emitTo("admins", "admin.content.published", { version });
  await logActivity({ userId: sub, action: "language.update", entityType: "language", ip: req.ip, detail: { code, action, ...input } });
  const saved = (await repo.listLanguages()).find((l) => l.code === code)!;
  res.status(action === "created" ? 201 : 200).json(toAdminLanguageDto(saved));
});

function toAdminUserDto(u: repo.AdminUserRow) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role,
    status: u.status,
    lockedReason: u.locked_reason,
    uiLocale: u.ui_locale,
    narrationLang: u.narration_lang,
    createdAt: u.created_at,
    online: u.online === 1,
    clientTypes: (["web", "mobile", "admin"] as const).filter((c) => u[`on_${c}`] === 1),
    lastSeenAt: u.last_seen_at,
    tour: u.tour_id ? { id: u.tour_id, code: u.tour_code, name: u.tour_name } : null,
    visits: u.visits,
  };
}

const usersQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  role: z.enum(["user", "guide", "admin"]).optional(),
  status: z.enum(["active", "locked"]).optional(),
  online: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

adminManagementRouter.get("/admin/users", async (req, res) => {
  const q = usersQuery.parse(req.query);
  const { rows, total } = await repo.listUsers({ ...q, q: q.q || undefined, offset: offsetOf(q), limit: q.pageSize });
  res.json({ items: rows.map(toAdminUserDto), page: q.page, pageSize: q.pageSize, total });
});

adminManagementRouter.get("/admin/users/:id", async (req, res) => {
  const id = idParam.parse(req.params.id);
  const user = await repo.findUser(id);
  if (!user) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy người dùng");
  const sessions = await repo.recentSessions(id);
  res.json({
    user: toAdminUserDto(user),
    sessions: sessions.map((s) => ({
      id: Number(s.id),
      clientType: s.client_type,
      ip: s.ip_address,
      userAgent: s.user_agent,
      connectedAt: s.connected_at,
      lastSeenAt: s.last_seen_at,
      disconnectedAt: s.disconnected_at,
    })),
  });
});

const patchUserSchema = z.union([
  z.object({ status: z.literal("locked"), reason: z.string().trim().min(1).max(300) }).strict(),
  z.object({ status: z.literal("active") }).strict(),
  z.object({ role: z.enum(["user", "guide", "admin"]) }).strict(),
]);

// Khóa/mở khóa ({ status, reason }) hoặc đổi vai trò ({ role }). Admin không tự khóa/đổi vai trò của chính mình.
adminManagementRouter.patch("/admin/users/:id", async (req, res) => {
  const { sub } = currentUser(res.locals);
  const id = idParam.parse(req.params.id);
  const input = patchUserSchema.parse(req.body);
  if (id === sub) throw new ApiError(409, "CANNOT_MODIFY_SELF", "Không thể khóa hoặc đổi vai trò của chính mình");
  const user = await repo.findUser(id);
  if (!user) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy người dùng");

  if ("role" in input) {
    await repo.setUserRole(id, input.role);
    await logActivity({ userId: sub, action: "admin.user.role_change", entityType: "user", entityId: id, ip: req.ip, detail: { from: user.role, to: input.role } });
  } else if (input.status === "locked") {
    await repo.setUserStatus(id, "locked", input.reason);
    // Báo client đăng xuất ngay rồi ngắt mọi socket; presence tự đóng phiên khi socket ngắt.
    emitTo(`user:${id}`, "session.revoked", { reason: "ACCOUNT_LOCKED" });
    disconnectUser(id);
    await logActivity({ userId: sub, action: "admin.user.lock", entityType: "user", entityId: id, ip: req.ip, detail: { reason: input.reason } });
  } else {
    await repo.setUserStatus(id, "active", null);
    await logActivity({ userId: sub, action: "admin.user.unlock", entityType: "user", entityId: id, ip: req.ip });
  }
  res.json(toAdminUserDto((await repo.findUser(id))!));
});

adminManagementRouter.get("/admin/tours", async (req, res) => {
  const { status } = z.object({ status: z.enum(["active", "ended"]).optional() }).parse(req.query);
  res.json({ items: (await listTours(status)).map(toTourDto) });
});

const logsQuery = pageQuery.extend({
  userId: z.coerce.number().int().positive().optional(),
  action: z.string().trim().regex(/^[a-z._]{1,50}$/, "Tên hành động, ví dụ auth.login hoặc place").optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

adminManagementRouter.get("/admin/activity-logs", async (req, res) => {
  const q = logsQuery.parse(req.query);
  const { rows, total } = await repo.listLogs({ ...q, offset: offsetOf(q), limit: q.pageSize });
  res.json({
    items: rows.map((l) => ({
      id: Number(l.id),
      user: l.user_id ? { id: l.user_id, fullName: l.user_name, email: l.user_email } : null,
      action: l.action,
      entityType: l.entity_type,
      entityId: l.entity_id,
      ip: l.ip_address,
      detail: l.detail ? (JSON.parse(l.detail) as unknown) : null,
      createdAt: l.created_at,
    })),
    page: q.page,
    pageSize: q.pageSize,
    total,
  });
});
