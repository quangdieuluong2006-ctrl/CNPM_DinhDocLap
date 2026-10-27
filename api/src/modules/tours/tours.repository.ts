import { randomInt } from "node:crypto";
import { getPool, sql } from "../../db/pool.js";
import { ApiError } from "../../lib/apiError.js";

export interface TourRow {
  id: number;
  code: string;
  name: string;
  guide_id: number;
  guide_name: string;
  status: "active" | "ended";
  max_members: number;
  member_count: number;
  created_at: Date;
  ended_at: Date | null;
}

const TOUR_SELECT = `
  SELECT t.id, t.code, t.name, t.guide_id, g.full_name AS guide_name, t.status, t.max_members, t.created_at, t.ended_at,
         (SELECT COUNT(*) FROM dbo.tour_members m WHERE m.tour_id = t.id AND m.left_at IS NULL) AS member_count
  FROM dbo.tours t JOIN dbo.users g ON g.id = t.guide_id`;

// Bỏ các ký tự dễ nhầm khi đọc cho nhau nghe (0/O, 1/I/L).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function newTourCode(): string {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

export async function findTour(by: { id: number } | { code: string }): Promise<TourRow | undefined> {
  const pool = await getPool();
  const req = pool.request();
  if ("id" in by) req.input("id", sql.Int, by.id);
  else req.input("code", sql.Char(6), by.code);
  const r = await req.query<TourRow>(`${TOUR_SELECT} WHERE ${"id" in by ? "t.id = @id" : "t.code = @code"}`);
  return r.recordset[0];
}

export async function activeMembership(userId: number): Promise<{ tour_id: number; code: string } | undefined> {
  const pool = await getPool();
  const r = await pool.request().input("user", sql.Int, userId).query<{ tour_id: number; code: string }>(`
    SELECT m.tour_id, t.code FROM dbo.tour_members m JOIN dbo.tours t ON t.id = m.tour_id
    WHERE m.user_id = @user AND m.left_at IS NULL;`);
  return r.recordset[0];
}

function alreadyInTour(m: { tour_id: number; code: string }): ApiError {
  return new ApiError(409, "ALREADY_IN_TOUR", "Bạn đang ở một nhóm khác, hãy rời nhóm đó trước", { tourId: m.tour_id, code: m.code });
}

// Tạo nhóm và thêm hướng dẫn viên làm thành viên đầu tiên (để vào phòng realtime của nhóm).
export async function createTour(guideId: number, name: string, maxMembers: number): Promise<number> {
  const existing = await activeMembership(guideId);
  if (existing) throw alreadyInTour(existing);
  const pool = await getPool();
  for (let attempt = 0; attempt < 5; attempt++) {
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const r = await new sql.Request(tx)
        .input("code", sql.Char(6), newTourCode())
        .input("name", sql.NVarChar(100), name)
        .input("guide", sql.Int, guideId)
        .input("max", sql.SmallInt, maxMembers).query<{ id: number }>(`
          INSERT INTO dbo.tours (code, name, guide_id, max_members) OUTPUT INSERTED.id VALUES (@code, @name, @guide, @max);`);
      const id = r.recordset[0]!.id;
      await new sql.Request(tx).input("tour", sql.Int, id).input("user", sql.Int, guideId)
        .query("INSERT INTO dbo.tour_members (tour_id, user_id) VALUES (@tour, @user);");
      await tx.commit();
      return id;
    } catch (err) {
      await tx.rollback();
      if (err instanceof sql.RequestError && (err.number === 2627 || err.number === 2601)) {
        if (String(err.message).includes("UX_members_one_active")) throw alreadyInTour((await activeMembership(guideId))!);
        continue; // trùng mã nhóm ngẫu nhiên → sinh mã khác
      }
      throw err;
    }
  }
  throw new Error("Không sinh được mã nhóm sau 5 lần thử");
}

export type JoinResult = "joined" | "already_member";

// Khóa dòng nhóm (UPDLOCK) để hai người cùng tham gia không vượt max_members.
export async function joinTour(tourId: number, userId: number): Promise<JoinResult> {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const t = await new sql.Request(tx).input("id", sql.Int, tourId).query<{ status: string; max_members: number }>(
      "SELECT status, max_members FROM dbo.tours WITH (UPDLOCK, ROWLOCK) WHERE id = @id");
    const tour = t.recordset[0];
    if (!tour) throw new ApiError(404, "TOUR_NOT_FOUND", "Không tìm thấy nhóm");
    if (tour.status !== "active") throw new ApiError(409, "TOUR_ENDED", "Nhóm đã kết thúc");

    const m = await new sql.Request(tx).input("user", sql.Int, userId).query<{ tour_id: number; code: string }>(`
      SELECT m.tour_id, t.code FROM dbo.tour_members m JOIN dbo.tours t ON t.id = m.tour_id
      WHERE m.user_id = @user AND m.left_at IS NULL;`);
    const current = m.recordset[0];
    if (current?.tour_id === tourId) {
      await tx.commit();
      return "already_member";
    }
    if (current) throw alreadyInTour(current);

    const c = await new sql.Request(tx).input("id", sql.Int, tourId)
      .query<{ n: number }>("SELECT COUNT(*) AS n FROM dbo.tour_members WHERE tour_id = @id AND left_at IS NULL");
    if (c.recordset[0]!.n >= tour.max_members) throw new ApiError(409, "TOUR_FULL", "Nhóm đã đủ thành viên");

    await new sql.Request(tx).input("tour", sql.Int, tourId).input("user", sql.Int, userId)
      .query("INSERT INTO dbo.tour_members (tour_id, user_id) VALUES (@tour, @user);");
    await tx.commit();
    return "joined";
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function leaveTour(tourId: number, userId: number): Promise<boolean> {
  const pool = await getPool();
  const r = await pool.request().input("tour", sql.Int, tourId).input("user", sql.Int, userId).query(`
    UPDATE dbo.tour_members SET left_at = SYSUTCDATETIME() WHERE tour_id = @tour AND user_id = @user AND left_at IS NULL;`);
  return r.rowsAffected[0] === 1;
}

// Kết thúc nhóm: mọi thành viên còn lại được tính là đã rời. Trả về danh sách user để rời phòng realtime.
export async function endTour(tourId: number): Promise<number[]> {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const r = await new sql.Request(tx).input("id", sql.Int, tourId).query<{ user_id: number }>(`
      UPDATE dbo.tours SET status = 'ended', ended_at = SYSUTCDATETIME() WHERE id = @id AND status = 'active';
      UPDATE dbo.tour_members SET left_at = SYSUTCDATETIME()
      OUTPUT INSERTED.user_id
      WHERE tour_id = @id AND left_at IS NULL;`);
    await tx.commit();
    return r.recordset.map((x) => x.user_id);
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export interface MemberRow {
  user_id: number;
  full_name: string;
  role: string;
  joined_at: Date;
  current_place_id: number | null;
  current_place_code: string | null;
  current_place_at: Date | null;
  online: number;
}

// "online" đọc từ view presence: có phiên đang mở và nhịp tim trong 60 giây.
export async function listMembers(tourId: number): Promise<MemberRow[]> {
  const pool = await getPool();
  const r = await pool.request().input("id", sql.Int, tourId).query<MemberRow>(`
    SELECT m.user_id, u.full_name, u.role, m.joined_at, m.current_place_id, p.code AS current_place_code, m.current_place_at,
           CASE WHEN a.user_id IS NULL THEN 0 ELSE 1 END AS online
    FROM dbo.tour_members m
    JOIN dbo.users u ON u.id = m.user_id
    LEFT JOIN dbo.places p ON p.id = m.current_place_id
    LEFT JOIN dbo.v_active_users a ON a.user_id = m.user_id
    WHERE m.tour_id = @id AND m.left_at IS NULL
    ORDER BY m.joined_at;`);
  return r.recordset;
}

// Chỉ chia sẻ điểm đang nghe (placeId), không bao giờ chia sẻ tọa độ (PRD v1.0, mục 4.7).
export async function setCurrentPlace(userId: number, placeId: number): Promise<number | undefined> {
  const pool = await getPool();
  const r = await pool.request().input("user", sql.Int, userId).input("place", sql.Int, placeId).query<{ tour_id: number }>(`
    UPDATE m SET current_place_id = p.id, current_place_at = SYSUTCDATETIME()
    OUTPUT INSERTED.tour_id
    FROM dbo.tour_members m JOIN dbo.places p ON p.id = @place
    WHERE m.user_id = @user AND m.left_at IS NULL;`);
  return r.recordset[0]?.tour_id;
}

export async function listTours(status?: "active" | "ended"): Promise<TourRow[]> {
  const pool = await getPool();
  const req = pool.request();
  let where = "";
  if (status) {
    req.input("status", sql.VarChar(10), status);
    where = "WHERE t.status = @status";
  }
  return (await req.query<TourRow>(`${TOUR_SELECT} ${where} ORDER BY t.created_at DESC, t.id DESC`)).recordset;
}
