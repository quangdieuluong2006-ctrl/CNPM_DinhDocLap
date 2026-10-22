import { getPool, sql } from "../../db/pool.js";
import type { Role } from "./tokens.js";

export interface UserRow {
  id: number;
  email: string;
  password_hash: string | null;
  full_name: string;
  role: Role;
  status: "active" | "locked";
  ui_locale: "vi" | "en";
  narration_lang: string | null;
  created_at: Date;
}

const USER_SELECT = `
  SELECT u.id, u.email, u.password_hash, u.full_name, u.role, u.status, u.ui_locale, u.narration_lang, u.created_at
  FROM dbo.users u`;

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const pool = await getPool();
  const r = await pool.request().input("email", sql.NVarChar(255), email)
    .query<UserRow>(`${USER_SELECT} WHERE u.email = @email`);
  return r.recordset[0];
}

export async function findUserById(id: number): Promise<UserRow | undefined> {
  const pool = await getPool();
  const r = await pool.request().input("id", sql.Int, id).query<UserRow>(`${USER_SELECT} WHERE u.id = @id`);
  return r.recordset[0];
}

// Trả về undefined nếu email đã tồn tại (vi phạm UQ_users_email).
export async function insertUser(input: {
  email: string;
  passwordHash: string;
  fullName: string;
  locale: "vi" | "en";
  narrationLang?: string;
}): Promise<number | undefined> {
  const pool = await getPool();
  try {
    const r = await pool
      .request()
      .input("email", sql.NVarChar(255), input.email)
      .input("hash", sql.NVarChar(255), input.passwordHash)
      .input("name", sql.NVarChar(100), input.fullName)
      .input("locale", sql.VarChar(5), input.locale)
      .input("lang", sql.VarChar(10), input.narrationLang ?? null).query<{ id: number }>(`
        INSERT INTO dbo.users (email, password_hash, full_name, ui_locale, narration_lang)
        OUTPUT INSERTED.id
        SELECT @email, @hash, @name, @locale, (SELECT code FROM dbo.languages WHERE code = @lang);`);
    return r.recordset[0]!.id;
  } catch (err) {
    // 2627: vi phạm UNIQUE constraint, 2601: vi phạm unique index
    if (err instanceof sql.RequestError && (err.number === 2627 || err.number === 2601)) return undefined;
    throw err;
  }
}

export async function insertRefreshToken(userId: number, tokenHash: string, ttlDays: number): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("user", sql.Int, userId)
    .input("hash", sql.Char(64), tokenHash)
    .input("days", sql.Int, ttlDays).query(`
      INSERT INTO dbo.refresh_tokens (user_id, token_hash, expires_at)
      VALUES (@user, @hash, DATEADD(DAY, @days, SYSUTCDATETIME()));`);
}

export type ConsumeResult =
  | { kind: "ok"; userId: number }
  | { kind: "reused"; userId: number } // token đã bị thu hồi mà vẫn được dùng lại
  | { kind: "invalid" };

// Thu hồi token một cách nguyên tử (UPDATE … OUTPUT): hai request dùng cùng token
// thì chỉ một request thành công.
export async function consumeRefreshToken(tokenHash: string): Promise<ConsumeResult> {
  const pool = await getPool();
  const r = await pool.request().input("hash", sql.Char(64), tokenHash).query<{ user_id: number }>(`
    UPDATE dbo.refresh_tokens SET revoked_at = SYSUTCDATETIME()
    OUTPUT INSERTED.user_id
    WHERE token_hash = @hash AND revoked_at IS NULL AND expires_at > SYSUTCDATETIME();`);
  const ok = r.recordset[0];
  if (ok) return { kind: "ok", userId: ok.user_id };

  const old = await pool.request().input("hash", sql.Char(64), tokenHash).query<{ user_id: number; revoked: boolean }>(`
    SELECT user_id, CAST(CASE WHEN revoked_at IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS revoked
    FROM dbo.refresh_tokens WHERE token_hash = @hash;`);
  const row = old.recordset[0];
  if (row?.revoked) return { kind: "reused", userId: row.user_id };
  return { kind: "invalid" };
}

export async function revokeRefreshToken(tokenHash: string): Promise<number | undefined> {
  const pool = await getPool();
  const r = await pool.request().input("hash", sql.Char(64), tokenHash).query<{ user_id: number }>(`
    UPDATE dbo.refresh_tokens SET revoked_at = SYSUTCDATETIME()
    OUTPUT INSERTED.user_id
    WHERE token_hash = @hash AND revoked_at IS NULL;`);
  return r.recordset[0]?.user_id;
}

// Dùng khi phát hiện token bị đánh cắp, và sau này khi admin khóa tài khoản (FE-13).
export async function revokeAllRefreshTokens(userId: number): Promise<void> {
  const pool = await getPool();
  await pool.request().input("user", sql.Int, userId).query(`
    UPDATE dbo.refresh_tokens SET revoked_at = SYSUTCDATETIME()
    WHERE user_id = @user AND revoked_at IS NULL;`);
}
