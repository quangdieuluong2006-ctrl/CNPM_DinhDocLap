import { getPool, sql } from "../../db/pool.js";
import { logger } from "../../lib/logger.js";

// Danh sách hành động được ghi: PRD v1.0, mục 13.2.
export type ActivityAction =
  | "auth.register"
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.refresh_reuse"
  | "place.create"
  | "place.update"
  | "place.delete"
  | "place.content.update"
  | "place.audio.upload"
  | "content.publish"
  | "language.update"
  | "tour.create"
  | "tour.end"
  | "admin.user.lock"
  | "admin.user.unlock"
  | "admin.user.role_change";

export interface ActivityEntry {
  userId?: number | null;
  action: ActivityAction;
  entityType?: string;
  entityId?: number;
  ip?: string;
  detail?: Record<string, unknown>;
}

// Ghi nhật ký không được làm hỏng nghiệp vụ chính: lỗi chỉ ghi log rồi bỏ qua.
export async function logActivity(entry: ActivityEntry): Promise<void> {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("user", sql.Int, entry.userId ?? null)
      .input("action", sql.VarChar(50), entry.action)
      .input("etype", sql.VarChar(30), entry.entityType ?? null)
      .input("eid", sql.Int, entry.entityId ?? null)
      .input("ip", sql.VarChar(45), entry.ip?.slice(0, 45) ?? null)
      .input("detail", sql.NVarChar(sql.MAX), entry.detail ? JSON.stringify(entry.detail) : null).query(`
        INSERT INTO dbo.activity_logs (user_id, action, entity_type, entity_id, ip_address, detail)
        VALUES (@user, @action, @etype, @eid, @ip, @detail);`);
  } catch (err) {
    logger.error({ err, action: entry.action }, "Không ghi được activity log");
  }
}
