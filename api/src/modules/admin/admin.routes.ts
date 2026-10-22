import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { clientTypeSchema } from "../auth/auth.schemas.js";
import * as presenceRepo from "../presence/presence.repository.js";
import * as adminRepo from "./admin.repository.js";
import { joinLinks } from "./joinLink.js";

// Mọi route /admin/* yêu cầu đăng nhập và vai trò admin (PRD v1.0, mục 15.1).
export const adminRouter = Router();
adminRouter.use("/admin", requireAuth, requireRole("admin"));

// FE-17: 6 thẻ thống kê + lượt tham quan 7 ngày + điểm nghe nhiều + ngôn ngữ được chọn.
adminRouter.get("/admin/stats", async (_req, res) => {
  const [s, visitsByDay, topPlaces, languages] = await Promise.all([
    adminRepo.dashboardStats(),
    adminRepo.visitsLast7Days(),
    adminRepo.topPlaces(),
    adminRepo.languageShare(),
  ]);
  res.json({
    totalUsers: s.total_users,
    activeUsers: s.active_users,
    visitsToday: s.visits_today,
    activeTours: s.active_tours,
    publishedPlaces: s.published_places,
    pendingContents: s.pending_contents,
    visitsByDay,
    topPlaces,
    languages,
  });
});

const presenceQuery = z.object({
  role: z.enum(["user", "all"]).default("user"),
  clientType: clientTypeSchema.optional(),
});

// FE-19: số và danh sách người dùng đang hoạt động (đọc từ view v_active_users).
adminRouter.get("/admin/presence", async (req, res) => {
  const q = presenceQuery.parse(req.query);
  const [rows, counts] = await Promise.all([
    presenceRepo.listActiveUsers({ excludeAdmins: q.role !== "all", clientType: q.clientType }),
    presenceRepo.countActiveUsers(),
  ]);
  res.json({
    count: rows.length, // số theo bộ lọc đang chọn
    activeUsers: counts.activeUsers, // không tính admin
    activeUsersAll: counts.activeUsersAll,
    users: rows.map((r) => ({
      userId: r.user_id,
      fullName: r.full_name,
      email: r.email,
      role: r.role,
      clientTypes: (["web", "mobile", "admin"] as const).filter((c) => r[`on_${c}`] === 1),
      openSessions: r.open_sessions,
      onlineSince: r.online_since,
      lastSeenAt: r.last_seen_at,
    })),
    ts: new Date().toISOString(),
  });
});

// Link + mã QR "Mời tham gia": người dùng quét bằng điện thoại để mở trang Đăng ký của Web User.
adminRouter.get("/admin/join-link", (_req, res) => {
  res.json({ links: joinLinks() });
});
