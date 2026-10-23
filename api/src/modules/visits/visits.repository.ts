import { getPool, sql } from "../../db/pool.js";

export const TRIGGERS = ["gps", "qr", "code", "manual", "simulated"] as const;
export type Trigger = (typeof TRIGGERS)[number];

export interface VisitInput {
  clientId: string;
  placeId: number;
  lang: string;
  trigger: Trigger;
  listenedSec: number;
  completed: boolean;
  startedAt: Date;
}

export type InsertResult = "accepted" | "duplicate" | "rejected";

// Bỏ trùng theo client_id (thiết bị gửi lại sau khi mất mạng). Điểm/ngôn ngữ không tồn tại → rejected.
export async function insertVisit(userId: number | null, v: VisitInput): Promise<InsertResult> {
  const pool = await getPool();
  try {
    const r = await pool
      .request()
      .input("client", sql.UniqueIdentifier, v.clientId)
      .input("user", sql.Int, userId)
      .input("place", sql.Int, v.placeId)
      .input("lang", sql.VarChar(10), v.lang)
      .input("trigger", sql.VarChar(10), v.trigger)
      .input("listened", sql.Int, v.listenedSec)
      .input("completed", sql.Bit, v.completed)
      .input("started", sql.DateTime2(0), v.startedAt).query<{ result: InsertResult }>(`
        IF EXISTS (SELECT 1 FROM dbo.visits WHERE client_id = @client)
          SELECT 'duplicate' AS result;
        ELSE
        BEGIN
          INSERT INTO dbo.visits (client_id, user_id, place_id, language_code, trigger_type, listened_sec, completed, started_at)
          SELECT @client, @user, p.id, l.code, @trigger, @listened, @completed, @started
          FROM dbo.places p CROSS JOIN dbo.languages l
          WHERE p.id = @place AND l.code = @lang;
          SELECT CASE WHEN @@ROWCOUNT = 1 THEN 'accepted' ELSE 'rejected' END AS result;
        END`);
    return r.recordset[0]!.result;
  } catch (err) {
    // Hai yêu cầu cùng client_id chạy song song: yêu cầu sau vi phạm UQ_visits_client.
    if (err instanceof sql.RequestError && (err.number === 2627 || err.number === 2601)) return "duplicate";
    throw err;
  }
}

export interface MyVisitRow {
  id: string;
  place_id: number;
  place_code: string;
  title: string;
  language_code: string;
  trigger_type: Trigger;
  listened_sec: number;
  completed: boolean;
  started_at: Date;
}

// Lịch sử tham quan; tiêu đề điểm theo ngôn ngữ của lượt nghe (dự phòng vi).
export async function listMyVisits(userId: number, offset: number, limit: number): Promise<{ rows: MyVisitRow[]; total: number }> {
  const pool = await getPool();
  const r = await pool.request().input("user", sql.Int, userId).input("off", sql.Int, offset).input("lim", sql.Int, limit)
    .query<MyVisitRow & { total: number }>(`
      SELECT v.id, v.place_id, p.code AS place_code,
             COALESCE(c.title, cvi.title, p.internal_name) AS title,
             v.language_code, v.trigger_type, v.listened_sec, v.completed, v.started_at,
             COUNT(*) OVER () AS total
      FROM dbo.visits v
      JOIN dbo.places p ON p.id = v.place_id
      LEFT JOIN dbo.place_contents c ON c.place_id = p.id AND c.language_code = v.language_code
      LEFT JOIN dbo.place_contents cvi ON cvi.place_id = p.id AND cvi.language_code = 'vi'
      WHERE v.user_id = @user
      ORDER BY v.started_at DESC, v.id DESC
      OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY;`);
  return { rows: r.recordset, total: r.recordset[0]?.total ?? (offset > 0 ? await countMyVisits(userId) : 0) };
}

async function countMyVisits(userId: number): Promise<number> {
  const pool = await getPool();
  const r = await pool.request().input("user", sql.Int, userId)
    .query<{ n: number }>("SELECT COUNT(*) AS n FROM dbo.visits WHERE user_id = @user");
  return r.recordset[0]!.n;
}
