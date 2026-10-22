import { getPool, sql } from "../../db/pool.js";
import { ApiError } from "../../lib/apiError.js";

export interface AdminPlaceRow {
  id: number;
  code: string;
  slug: string;
  internal_name: string;
  trigger_type: "gps" | "indoor";
  zone: string;
  lat: number;
  lng: number;
  radius_m: number;
  priority: number;
  sort_order: number;
  image_url: string | null;
  status: "draft" | "published" | "hidden";
  created_at: Date;
  updated_at: Date | null;
  visits: number;
  approved: number;
  pending: number;
  draft: number;
  audio_count: number;
}

const PLACE_SELECT = `
  SELECT p.id, p.code, p.slug, p.internal_name, p.trigger_type, p.zone, p.lat, p.lng, p.radius_m, p.priority, p.sort_order,
         p.image_url, p.status, p.created_at, p.updated_at, ISNULL(s.visits, 0) AS visits,
         (SELECT COUNT(*) FROM dbo.place_contents c WHERE c.place_id = p.id AND c.status = 'approved') AS approved,
         (SELECT COUNT(*) FROM dbo.place_contents c WHERE c.place_id = p.id AND c.status = 'pending') AS pending,
         (SELECT COUNT(*) FROM dbo.place_contents c WHERE c.place_id = p.id AND c.status = 'draft') AS draft,
         (SELECT COUNT(*) FROM dbo.place_contents c WHERE c.place_id = p.id AND c.audio_url IS NOT NULL) AS audio_count
  FROM dbo.places p LEFT JOIN dbo.v_place_stats s ON s.place_id = p.id`;

export async function listPlaces(filter: { status?: string; zone?: string; q?: string }): Promise<AdminPlaceRow[]> {
  const pool = await getPool();
  const req = pool.request();
  const where: string[] = [];
  if (filter.status) {
    req.input("status", sql.VarChar(10), filter.status);
    where.push("p.status = @status");
  }
  if (filter.zone) {
    req.input("zone", sql.VarChar(12), filter.zone);
    where.push("p.zone = @zone");
  }
  if (filter.q) {
    req.input("q", sql.NVarChar(102), `%${filter.q.replace(/[[%_]/g, "[$&]")}%`);
    where.push("(p.code LIKE @q OR p.slug LIKE @q OR p.internal_name LIKE @q)");
  }
  const r = await req.query<AdminPlaceRow>(
    `${PLACE_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY p.sort_order, p.code`);
  return r.recordset;
}

export async function findPlace(id: number): Promise<AdminPlaceRow | undefined> {
  const pool = await getPool();
  const r = await pool.request().input("id", sql.Int, id).query<AdminPlaceRow>(`${PLACE_SELECT} WHERE p.id = @id`);
  return r.recordset[0];
}

export interface PlaceInput {
  code: string;
  slug: string;
  internalName: string;
  trigger: "gps" | "indoor";
  zone: string;
  lat: number;
  lng: number;
  radiusM: number;
  priority: number;
  sortOrder: number;
  status: "draft" | "published" | "hidden";
}

function uniqueError(err: unknown): never {
  if (err instanceof sql.RequestError && (err.number === 2627 || err.number === 2601)) {
    if (err.message.includes("UQ_places_slug")) throw new ApiError(409, "PLACE_SLUG_TAKEN", "Đường dẫn (slug) đã được dùng cho điểm khác");
    throw new ApiError(409, "PLACE_CODE_TAKEN", "Số điểm đã được dùng cho điểm khác");
  }
  throw err;
}

function bindPlace(req: sql.Request, p: PlaceInput): sql.Request {
  return req
    .input("code", sql.Char(3), p.code)
    .input("slug", sql.VarChar(80), p.slug)
    .input("name", sql.NVarChar(120), p.internalName)
    .input("trigger", sql.VarChar(10), p.trigger)
    .input("zone", sql.VarChar(12), p.zone)
    .input("lat", sql.Decimal(9, 6), p.lat)
    .input("lng", sql.Decimal(9, 6), p.lng)
    .input("radius", sql.SmallInt, p.radiusM)
    .input("priority", sql.SmallInt, p.priority)
    .input("sort", sql.Int, p.sortOrder)
    .input("status", sql.VarChar(10), p.status);
}

export async function insertPlace(p: PlaceInput): Promise<number> {
  const pool = await getPool();
  try {
    const r = await bindPlace(pool.request(), p).query<{ id: number }>(`
      INSERT INTO dbo.places (code, slug, internal_name, trigger_type, zone, lat, lng, radius_m, priority, sort_order, status)
      OUTPUT INSERTED.id
      VALUES (@code, @slug, @name, @trigger, @zone, @lat, @lng, @radius, @priority, @sort, @status);`);
    return r.recordset[0]!.id;
  } catch (err) {
    return uniqueError(err);
  }
}

export async function updatePlace(id: number, p: PlaceInput): Promise<void> {
  const pool = await getPool();
  try {
    await bindPlace(pool.request().input("id", sql.Int, id), p).query(`
      UPDATE dbo.places SET code = @code, slug = @slug, internal_name = @name, trigger_type = @trigger, zone = @zone,
             lat = @lat, lng = @lng, radius_m = @radius, priority = @priority, sort_order = @sort, status = @status,
             updated_at = SYSUTCDATETIME()
      WHERE id = @id;`);
  } catch (err) {
    uniqueError(err);
  }
}

export async function setPlaceImage(id: number, url: string | null): Promise<void> {
  const pool = await getPool();
  await pool.request().input("id", sql.Int, id).input("url", sql.NVarChar(500), url)
    .query("UPDATE dbo.places SET image_url = @url, updated_at = SYSUTCDATETIME() WHERE id = @id");
}

// Điểm đã có lượt ghé không được xóa (giữ lịch sử thống kê), chỉ được ẩn.
export async function deletePlace(id: number): Promise<"deleted" | "has_visits" | "not_found"> {
  const pool = await getPool();
  const r = await pool.request().input("id", sql.Int, id).query<{ result: "deleted" | "has_visits" | "not_found" }>(`
    IF NOT EXISTS (SELECT 1 FROM dbo.places WHERE id = @id) SELECT 'not_found' AS result;
    ELSE IF EXISTS (SELECT 1 FROM dbo.visits WHERE place_id = @id)
      OR EXISTS (SELECT 1 FROM dbo.tour_members WHERE current_place_id = @id) SELECT 'has_visits' AS result;
    ELSE BEGIN
      DELETE FROM dbo.places WHERE id = @id;
      SELECT 'deleted' AS result;
    END`);
  return r.recordset[0]!.result;
}

// Các điểm GPS khác để cảnh báo vùng kích hoạt chồng lấn.
export async function otherGpsPlaces(excludeId: number | null): Promise<{ code: string; lat: number; lng: number; radius_m: number }[]> {
  const pool = await getPool();
  const r = await pool.request().input("id", sql.Int, excludeId)
    .query<{ code: string; lat: number; lng: number; radius_m: number }>(`
      SELECT code, lat, lng, radius_m FROM dbo.places
      WHERE trigger_type = 'gps' AND status <> 'hidden' AND (@id IS NULL OR id <> @id);`);
  return r.recordset;
}

export interface ContentRow {
  language_code: string;
  title: string;
  summary: string;
  body: string;
  audio_url: string | null;
  audio_duration_sec: number | null;
  audio_bytes: number | null;
  status: "draft" | "pending" | "approved";
  source: "human" | "machine";
  updated_by: number | null;
  updated_by_name: string | null;
  updated_at: Date;
}

export async function listContents(placeId: number): Promise<ContentRow[]> {
  const pool = await getPool();
  const r = await pool.request().input("id", sql.Int, placeId).query<ContentRow>(`
    SELECT c.language_code, c.title, c.summary, c.body, c.audio_url, c.audio_duration_sec, c.audio_bytes,
           c.status, c.source, c.updated_by, u.full_name AS updated_by_name, c.updated_at
    FROM dbo.place_contents c
    JOIN dbo.languages l ON l.code = c.language_code
    LEFT JOIN dbo.users u ON u.id = c.updated_by
    WHERE c.place_id = @id
    ORDER BY l.sort_order, l.code;`);
  return r.recordset;
}

export async function findContent(placeId: number, lang: string): Promise<ContentRow | undefined> {
  return (await listContents(placeId)).find((c) => c.language_code === lang);
}

export interface ContentInput {
  title: string;
  summary: string;
  body: string;
  status: "draft" | "pending" | "approved";
  source: "human" | "machine";
}

// Tạo hoặc sửa bài của một ngôn ngữ (UPSERT theo UNIQUE(place_id, language_code)).
export async function upsertContent(placeId: number, lang: string, c: ContentInput, userId: number): Promise<"created" | "updated"> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("place", sql.Int, placeId)
    .input("lang", sql.VarChar(10), lang)
    .input("title", sql.NVarChar(120), c.title)
    .input("summary", sql.NVarChar(300), c.summary)
    .input("body", sql.NVarChar(sql.MAX), c.body)
    .input("status", sql.VarChar(10), c.status)
    .input("source", sql.VarChar(10), c.source)
    .input("user", sql.Int, userId).query<{ action: string }>(`
      MERGE dbo.place_contents WITH (HOLDLOCK) AS t
      USING (SELECT @place AS place_id, @lang AS language_code) AS s
        ON t.place_id = s.place_id AND t.language_code = s.language_code
      WHEN MATCHED THEN UPDATE SET title = @title, summary = @summary, body = @body, status = @status, source = @source,
           updated_by = @user, updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (place_id, language_code, title, summary, body, status, source, updated_by)
           VALUES (@place, @lang, @title, @summary, @body, @status, @source, @user)
      OUTPUT $action AS action;`);
  return r.recordset[0]!.action === "INSERT" ? "created" : "updated";
}

export async function setContentAudio(
  placeId: number,
  lang: string,
  audio: { url: string; durationSec: number | null; bytes: number } | null,
  userId: number,
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("place", sql.Int, placeId)
    .input("lang", sql.VarChar(10), lang)
    .input("url", sql.NVarChar(500), audio?.url ?? null)
    .input("dur", sql.Int, audio?.durationSec ?? null)
    .input("bytes", sql.Int, audio?.bytes ?? null)
    .input("user", sql.Int, userId).query(`
      UPDATE dbo.place_contents SET audio_url = @url, audio_duration_sec = @dur, audio_bytes = @bytes,
             updated_by = @user, updated_at = SYSUTCDATETIME()
      WHERE place_id = @place AND language_code = @lang;`);
}

export async function deleteContent(placeId: number, lang: string): Promise<boolean> {
  const pool = await getPool();
  const r = await pool.request().input("place", sql.Int, placeId).input("lang", sql.VarChar(10), lang)
    .query("DELETE FROM dbo.place_contents WHERE place_id = @place AND language_code = @lang");
  return r.rowsAffected[0] === 1;
}

// Tăng phiên bản gói nội dung: ứng dụng thấy ETag mới và tải lại (PRD v1.0, SD-03).
export async function publishRelease(userId: number, note: string): Promise<number> {
  const pool = await getPool();
  const r = await pool.request().input("published_by", sql.Int, userId).input("note", sql.NVarChar(300), note.slice(0, 300))
    .execute<{ version: number }>("dbo.sp_publish_content");
  return r.recordset[0]!.version;
}
