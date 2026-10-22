import { getPool, sql } from "../../db/pool.js";

// ---- Ngôn ngữ (FE-22) ----
export interface AdminLanguageRow {
  code: string;
  name_vi: string;
  name_en: string;
  name_native: string;
  tts_locale: string;
  is_enabled: boolean;
  sort_order: number;
  published_places: number;
  approved: number;
  pending: number;
  draft: number;
}

export async function listLanguages(): Promise<AdminLanguageRow[]> {
  const pool = await getPool();
  const r = await pool.request().query<AdminLanguageRow>(`
    SELECT l.code, l.name_vi, l.name_en, l.name_native, l.tts_locale, l.is_enabled, l.sort_order,
           lc.published_places, lc.approved, lc.pending, lc.draft
    FROM dbo.languages l JOIN dbo.v_language_completeness lc ON lc.code = l.code
    ORDER BY l.sort_order, l.code;`);
  return r.recordset;
}

export async function upsertLanguage(l: {
  code: string; nameVi: string; nameEn: string; nameNative: string; ttsLocale: string; isEnabled: boolean; sortOrder: number;
}): Promise<"created" | "updated"> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("code", sql.VarChar(10), l.code)
    .input("vi", sql.NVarChar(60), l.nameVi)
    .input("en", sql.NVarChar(60), l.nameEn)
    .input("native", sql.NVarChar(60), l.nameNative)
    .input("tts", sql.VarChar(20), l.ttsLocale)
    .input("enabled", sql.Bit, l.isEnabled)
    .input("sort", sql.Int, l.sortOrder).query<{ action: string }>(`
      MERGE dbo.languages WITH (HOLDLOCK) AS t USING (SELECT @code AS code) AS s ON t.code = s.code
      WHEN MATCHED THEN UPDATE SET name_vi = @vi, name_en = @en, name_native = @native, tts_locale = @tts,
           is_enabled = @enabled, sort_order = @sort
      WHEN NOT MATCHED THEN INSERT (code, name_vi, name_en, name_native, tts_locale, is_enabled, sort_order)
           VALUES (@code, @vi, @en, @native, @tts, @enabled, @sort)
      OUTPUT $action AS action;`);
  return r.recordset[0]!.action === "INSERT" ? "created" : "updated";
}

// ---- Người dùng (FE-18) ----
export interface AdminUserRow {
  id: number;
  email: string;
  full_name: string;
  role: "user" | "guide" | "admin";
  status: "active" | "locked";
  locked_reason: string | null;
  ui_locale: string;
  narration_lang: string | null;
  created_at: Date;
  last_seen_at: Date | null;
  online: number;
  on_web: number | null;
  on_mobile: number | null;
  on_admin: number | null;
  tour_id: number | null;
  tour_code: string | null;
  tour_name: string | null;
  visits: number;
  total: number;
}

const USER_SELECT = `
  SELECT u.id, u.email, u.full_name, u.role, u.status, u.locked_reason, u.ui_locale, u.narration_lang, u.created_at,
         ls.last_seen_at, CASE WHEN a.user_id IS NULL THEN 0 ELSE 1 END AS online, a.on_web, a.on_mobile, a.on_admin,
         t.id AS tour_id, t.code AS tour_code, t.name AS tour_name,
         (SELECT COUNT(*) FROM dbo.visits v WHERE v.user_id = u.id) AS visits,
         COUNT(*) OVER () AS total
  FROM dbo.users u
  LEFT JOIN dbo.v_user_last_seen ls ON ls.user_id = u.id
  LEFT JOIN dbo.v_active_users a ON a.user_id = u.id
  LEFT JOIN dbo.tour_members m ON m.user_id = u.id AND m.left_at IS NULL
  LEFT JOIN dbo.tours t ON t.id = m.tour_id`;

export async function listUsers(f: {
  q?: string; role?: string; status?: string; online?: boolean; offset: number; limit: number;
}): Promise<{ rows: AdminUserRow[]; total: number }> {
  const pool = await getPool();
  const req = pool.request().input("off", sql.Int, f.offset).input("lim", sql.Int, f.limit);
  const where: string[] = [];
  if (f.q) {
    req.input("q", sql.NVarChar(102), `%${f.q.replace(/[[%_]/g, "[$&]")}%`);
    where.push("(u.email LIKE @q OR u.full_name LIKE @q)");
  }
  if (f.role) {
    req.input("role", sql.VarChar(10), f.role);
    where.push("u.role = @role");
  }
  if (f.status) {
    req.input("status", sql.VarChar(10), f.status);
    where.push("u.status = @status");
  }
  if (f.online !== undefined) where.push(f.online ? "a.user_id IS NOT NULL" : "a.user_id IS NULL");
  const r = await req.query<AdminUserRow>(`
    ${USER_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY CASE WHEN a.user_id IS NULL THEN 1 ELSE 0 END, ls.last_seen_at DESC, u.id
    OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY;`);
  return { rows: r.recordset, total: r.recordset[0]?.total ?? 0 };
}

export async function findUser(id: number): Promise<AdminUserRow | undefined> {
  const pool = await getPool();
  const r = await pool.request().input("id", sql.Int, id).query<AdminUserRow>(`${USER_SELECT} WHERE u.id = @id`);
  return r.recordset[0];
}

export interface SessionRow {
  id: string;
  client_type: string;
  ip_address: string | null;
  user_agent: string | null;
  connected_at: Date;
  last_seen_at: Date;
  disconnected_at: Date | null;
}

export async function recentSessions(userId: number, limit = 20): Promise<SessionRow[]> {
  const pool = await getPool();
  const r = await pool.request().input("id", sql.Int, userId).input("lim", sql.Int, limit).query<SessionRow>(`
    SELECT TOP (@lim) id, client_type, ip_address, user_agent, connected_at, last_seen_at, disconnected_at
    FROM dbo.user_sessions WHERE user_id = @id ORDER BY connected_at DESC, id DESC;`);
  return r.recordset;
}

// Khóa: thu hồi mọi refresh token để không làm mới được phiên. Mở khóa: xóa lý do.
export async function setUserStatus(id: number, status: "active" | "locked", reason: string | null): Promise<void> {
  const pool = await getPool();
  await pool.request().input("id", sql.Int, id).input("status", sql.VarChar(10), status)
    .input("reason", sql.NVarChar(300), status === "locked" ? reason : null).query(`
      UPDATE dbo.users SET status = @status, locked_reason = @reason, updated_at = SYSUTCDATETIME() WHERE id = @id;
      IF @status = 'locked'
        UPDATE dbo.refresh_tokens SET revoked_at = SYSUTCDATETIME() WHERE user_id = @id AND revoked_at IS NULL;`);
}

export async function setUserRole(id: number, role: "user" | "guide" | "admin"): Promise<void> {
  const pool = await getPool();
  await pool.request().input("id", sql.Int, id).input("role", sql.VarChar(10), role)
    .query("UPDATE dbo.users SET role = @role, updated_at = SYSUTCDATETIME() WHERE id = @id");
}

// ---- Nhật ký (FE-24) ----
export interface LogRow {
  id: string;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  ip_address: string | null;
  detail: string | null;
  created_at: Date;
  total: number;
}

export async function listLogs(f: {
  userId?: number; action?: string; from?: Date; to?: Date; offset: number; limit: number;
}): Promise<{ rows: LogRow[]; total: number }> {
  const pool = await getPool();
  const req = pool.request().input("off", sql.Int, f.offset).input("lim", sql.Int, f.limit);
  const where: string[] = [];
  if (f.userId) {
    req.input("user", sql.Int, f.userId);
    where.push("l.user_id = @user");
  }
  if (f.action) {
    // "place" lọc mọi hành động bắt đầu bằng "place."; "auth.login" lọc đúng hành động đó.
    req.input("action", sql.VarChar(50), f.action).input("prefix", sql.VarChar(52), `${f.action.replace(/[[%_]/g, "[$&]")}.%`);
    where.push("(l.action = @action OR l.action LIKE @prefix)");
  }
  if (f.from) {
    req.input("from", sql.DateTime2(0), f.from);
    where.push("l.created_at >= @from");
  }
  if (f.to) {
    req.input("to", sql.DateTime2(0), f.to);
    where.push("l.created_at < @to");
  }
  const r = await req.query<LogRow>(`
    SELECT l.id, l.user_id, u.full_name AS user_name, u.email AS user_email, l.action, l.entity_type, l.entity_id,
           l.ip_address, l.detail, l.created_at, COUNT(*) OVER () AS total
    FROM dbo.activity_logs l LEFT JOIN dbo.users u ON u.id = l.user_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY l.created_at DESC, l.id DESC
    OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY;`);
  return { rows: r.recordset, total: r.recordset[0]?.total ?? 0 };
}
