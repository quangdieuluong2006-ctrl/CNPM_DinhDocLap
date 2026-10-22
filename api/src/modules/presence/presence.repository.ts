import { getPool, sql } from "../../db/pool.js";
import type { ClientType } from "../auth/auth.schemas.js";
import type { Role } from "../auth/tokens.js";

// Ngưỡng "đang hoạt động" – phải khớp DATEADD(SECOND, -60, …) trong view dbo.v_active_users.
export const PRESENCE_STALE_SEC = 60;

export async function openSession(input: {
  userId: number;
  clientType: ClientType;
  socketId?: string | null;
  ip?: string;
  userAgent?: string;
}): Promise<number> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("user", sql.Int, input.userId)
    .input("client", sql.VarChar(10), input.clientType)
    .input("socket", sql.VarChar(64), input.socketId ?? null)
    .input("ip", sql.VarChar(45), input.ip?.slice(0, 45) ?? null)
    .input("ua", sql.NVarChar(300), input.userAgent?.slice(0, 300) ?? null).query<{ id: number }>(`
      INSERT INTO dbo.user_sessions (user_id, client_type, socket_id, ip_address, user_agent)
      OUTPUT INSERTED.id
      VALUES (@user, @client, @socket, @ip, @ua);`);
  return Number(r.recordset[0]!.id); // BIGINT được mssql trả về dạng string
}

// Nhịp tim: cập nhật last_seen_at. Trả false nếu phiên đã bị đóng (ví dụ máy ngủ quá 60 giây).
export async function touchSession(sessionId: number, userId: number): Promise<boolean> {
  const pool = await getPool();
  const r = await pool.request().input("id", sql.BigInt, sessionId).input("user", sql.Int, userId).query(`
    UPDATE dbo.user_sessions SET last_seen_at = SYSUTCDATETIME()
    WHERE id = @id AND user_id = @user AND disconnected_at IS NULL;`);
  return r.rowsAffected[0] === 1;
}

export async function closeSession(sessionId: number): Promise<void> {
  const pool = await getPool();
  await pool.request().input("id", sql.BigInt, sessionId).query(`
    UPDATE dbo.user_sessions SET disconnected_at = SYSUTCDATETIME()
    WHERE id = @id AND disconnected_at IS NULL;`);
}

// Mất mạng/tắt máy đột ngột không có sự kiện disconnect → đóng phiên quá hạn. Trả về user bị ảnh hưởng.
export async function closeStaleSessions(): Promise<number[]> {
  const pool = await getPool();
  const r = await pool.request().input("sec", sql.Int, PRESENCE_STALE_SEC).query<{ user_id: number }>(`
    UPDATE dbo.user_sessions SET disconnected_at = SYSUTCDATETIME()
    OUTPUT INSERTED.user_id
    WHERE disconnected_at IS NULL AND last_seen_at <= DATEADD(SECOND, -@sec, SYSUTCDATETIME());`);
  return [...new Set(r.recordset.map((x) => x.user_id))];
}

// Khi API khởi động lại, mọi socket cũ đã mất → đóng các phiên còn mở (NFR-19).
// Lưu ý: chỉ đúng khi chạy MỘT tiến trình API (phạm vi đồ án).
export async function closeAllOpenSessions(): Promise<number> {
  const pool = await getPool();
  const r = await pool.request().query(`
    UPDATE dbo.user_sessions SET disconnected_at = SYSUTCDATETIME() WHERE disconnected_at IS NULL;`);
  return r.rowsAffected[0] ?? 0;
}

// Phiên dự phòng của REST heartbeat (không có socket): tìm phiên còn mở cùng loại client để dùng lại.
export async function findOpenRestSession(userId: number, clientType: ClientType): Promise<number | undefined> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("user", sql.Int, userId)
    .input("client", sql.VarChar(10), clientType)
    .input("sec", sql.Int, PRESENCE_STALE_SEC).query<{ id: string }>(`
      SELECT TOP (1) id FROM dbo.user_sessions
      WHERE user_id = @user AND client_type = @client AND socket_id IS NULL AND disconnected_at IS NULL
        AND last_seen_at > DATEADD(SECOND, -@sec, SYSUTCDATETIME())
      ORDER BY last_seen_at DESC;`);
  const id = r.recordset[0]?.id;
  return id === undefined ? undefined : Number(id);
}

export interface ActiveUserRow {
  user_id: number;
  full_name: string;
  email: string;
  role: Role;
  last_seen_at: Date;
  online_since: Date;
  open_sessions: number;
  on_mobile: number;
  on_web: number;
  on_admin: number;
}

// excludeAdmins: chỉ tính khách tham quan và hướng dẫn viên (mặc định của trang Người dùng đang hoạt động).
export async function listActiveUsers(filter: { excludeAdmins?: boolean; clientType?: ClientType }): Promise<ActiveUserRow[]> {
  const pool = await getPool();
  // Tên cột lấy từ danh sách cố định, không ghép chuỗi từ dữ liệu người dùng.
  const clientCol = { web: "on_web", mobile: "on_mobile", admin: "on_admin" } as const;
  const where = ["1 = 1"];
  if (filter.excludeAdmins) where.push("role <> 'admin'");
  if (filter.clientType) where.push(`${clientCol[filter.clientType]} = 1`);
  const r = await pool
    .request()
    .query<ActiveUserRow>(`SELECT * FROM dbo.v_active_users WHERE ${where.join(" AND ")} ORDER BY online_since;`);
  return r.recordset;
}

export async function countActiveUsers(): Promise<{ activeUsers: number; activeUsersAll: number }> {
  const pool = await getPool();
  const r = await pool.request().query<{ activeUsers: number; activeUsersAll: number }>(`
    SELECT SUM(CASE WHEN role <> 'admin' THEN 1 ELSE 0 END) AS activeUsers, COUNT(*) AS activeUsersAll
    FROM dbo.v_active_users;`);
  const row = r.recordset[0];
  return { activeUsers: row?.activeUsers ?? 0, activeUsersAll: row?.activeUsersAll ?? 0 };
}

export async function isUserActive(userId: number): Promise<boolean> {
  const pool = await getPool();
  const r = await pool.request().input("user", sql.Int, userId)
    .query<{ n: number }>("SELECT COUNT(*) AS n FROM dbo.v_active_users WHERE user_id = @user;");
  return r.recordset[0]!.n > 0;
}
