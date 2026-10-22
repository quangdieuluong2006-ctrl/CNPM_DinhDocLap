import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../../lib/apiError.js";
import { offsetOf, pageQuery } from "../../lib/pagination.js";
import { currentUser, optionalAuth, requireAuth } from "../../middlewares/auth.js";
import { emitTo } from "../../realtime/hub.js";
import { langSchema } from "../content/content.schemas.js";
import * as repo from "./visits.repository.js";

// Lượt ghé: một lần bắt đầu nghe thuyết minh tại một điểm (PRD v1.0, mục 11.2, 11.3.2).
// Khách chưa đăng nhập vẫn được ghi (user_id NULL) để thống kê lượt tham quan đầy đủ.
export const visitsRouter = Router();

const MAX_LISTEN_SEC = 3 * 3600;
const visitSchema = z.object({
  clientId: z.uuid(),
  placeId: z.number().int().positive(),
  lang: langSchema,
  trigger: z.enum(repo.TRIGGERS),
  listenedSec: z.number().int().min(0).max(MAX_LISTEN_SEC).default(0),
  completed: z.boolean().default(false),
  // Lượt ghi khi offline có thể gửi trễ vài ngày; không nhận thời điểm ở tương lai (lệch đồng hồ tối đa 5 phút).
  startedAt: z.coerce
    .date()
    .refine((d) => d.getTime() <= Date.now() + 5 * 60_000, "startedAt không được ở tương lai")
    .refine((d) => d.getTime() >= Date.now() - 30 * 86_400_000, "startedAt quá 30 ngày"),
});

function announce(v: z.infer<typeof visitSchema>): void {
  if (v.trigger !== "simulated") emitTo("admins", "admin.visit.created", { placeId: v.placeId, lang: v.lang, trigger: v.trigger });
}

visitsRouter.post("/visits", optionalAuth, async (req, res) => {
  const v = visitSchema.parse(req.body);
  const userId = res.locals.auth?.sub ?? null;
  const result = await repo.insertVisit(userId, v);
  if (result === "rejected") throw new ApiError(404, "PLACE_NOT_FOUND", "Điểm thuyết minh hoặc ngôn ngữ không tồn tại");
  if (result === "accepted") announce(v);
  res.status(result === "accepted" ? 201 : 200).json({ result });
});

// Đồng bộ các lượt ghi khi offline. Từng lượt được xử lý riêng: một lượt sai không làm hỏng cả lô.
visitsRouter.post("/visits/batch", optionalAuth, async (req, res) => {
  const { visits } = z.object({ visits: z.array(z.unknown()).min(1).max(200) }).parse(req.body);
  const userId = res.locals.auth?.sub ?? null;
  const out = { accepted: 0, duplicates: 0, rejected: 0, errors: [] as { index: number; code: string }[] };
  for (const [index, raw] of visits.entries()) {
    const parsed = visitSchema.safeParse(raw);
    if (!parsed.success) {
      out.rejected++;
      out.errors.push({ index, code: "VALIDATION_ERROR" });
      continue;
    }
    const result = await repo.insertVisit(userId, parsed.data);
    if (result === "accepted") {
      out.accepted++;
      announce(parsed.data);
    } else if (result === "duplicate") out.duplicates++;
    else {
      out.rejected++;
      out.errors.push({ index, code: "PLACE_NOT_FOUND" });
    }
  }
  res.json(out);
});

visitsRouter.get("/me/visits", requireAuth, async (req, res) => {
  const p = pageQuery.parse(req.query);
  const { rows, total } = await repo.listMyVisits(currentUser(res.locals).sub, offsetOf(p), p.pageSize);
  res.json({
    items: rows.map((r) => ({
      id: Number(r.id),
      placeId: r.place_id,
      placeCode: r.place_code,
      title: r.title,
      lang: r.language_code,
      trigger: r.trigger_type,
      listenedSec: r.listened_sec,
      completed: r.completed,
      startedAt: r.started_at,
    })),
    page: p.page,
    pageSize: p.pageSize,
    total,
  });
});
