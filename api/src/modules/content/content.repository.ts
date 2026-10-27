import { getPool, sql } from "../../db/pool.js";

// Khách chỉ thấy điểm "published" và bài "approved" hoặc "pending" (bài chờ duyệt hiển thị kèm nhãn,
// bài nháp không hiển thị – PRD v1.0, FE-21). Thiếu bài ngôn ngữ đã chọn thì dự phòng en → vi.
export const VISIBLE_CONTENT = "c.status IN ('approved', 'pending')";

export interface PublicLanguageRow {
  code: string;
  name_vi: string;
  name_en: string;
  name_native: string;
  tts_locale: string;
  sort_order: number;
  published_places: number;
  approved: number;
  pending: number;
}

// Ngôn ngữ đang bật và có ít nhất một bài hiển thị được trên điểm đã xuất bản.
export async function listPublicLanguages(): Promise<PublicLanguageRow[]> {
  const pool = await getPool();
  const r = await pool.request().query<PublicLanguageRow>(`
    SELECT l.code, l.name_vi, l.name_en, l.name_native, l.tts_locale, l.sort_order,
           lc.published_places, lc.approved, lc.pending
    FROM dbo.languages l
    JOIN dbo.v_language_completeness lc ON lc.code = l.code
    WHERE l.is_enabled = 1 AND lc.approved + lc.pending > 0
    ORDER BY l.sort_order, l.code;`);
  return r.recordset;
}

export async function getLanguage(code: string): Promise<{ code: string; tts_locale: string; is_enabled: boolean } | undefined> {
  const pool = await getPool();
  const r = await pool.request().input("code", sql.VarChar(10), code)
    .query<{ code: string; tts_locale: string; is_enabled: boolean }>(
      "SELECT code, tts_locale, is_enabled FROM dbo.languages WHERE code = @code");
  return r.recordset[0];
}

export interface PublicPlaceRow {
  id: number;
  code: string;
  slug: string;
  trigger_type: "gps" | "indoor";
  zone: string;
  lat: number;
  lng: number;
  radius_m: number;
  priority: number;
  sort_order: number;
  image_url: string | null;
  c_lang: string | null;
  c_title: string | null;
  c_summary: string | null;
  c_body: string | null;
  c_status: "approved" | "pending" | null;
  c_audio_url: string | null;
  c_audio_duration_sec: number | null;
  c_audio_bytes: number | null;
}

// OUTER APPLY chọn đúng một bài cho mỗi điểm: ngôn ngữ đã chọn → en → vi.
function placeQuery(where: string, withBody: boolean): string {
  return `
    SELECT p.id, p.code, p.slug, p.trigger_type, p.zone, p.lat, p.lng, p.radius_m, p.priority, p.sort_order, p.image_url,
           c.language_code AS c_lang, c.title AS c_title, c.summary AS c_summary,
           ${withBody ? "c.body" : "CAST(NULL AS NVARCHAR(1))"} AS c_body, c.status AS c_status,
           c.audio_url AS c_audio_url, c.audio_duration_sec AS c_audio_duration_sec, c.audio_bytes AS c_audio_bytes
    FROM dbo.places p
    OUTER APPLY (
      SELECT TOP (1) c.* FROM dbo.place_contents c
      WHERE c.place_id = p.id AND ${VISIBLE_CONTENT} AND c.language_code IN (@lang, 'en', 'vi')
      ORDER BY CASE c.language_code WHEN @lang THEN 0 WHEN 'en' THEN 1 ELSE 2 END
    ) c
    WHERE p.status = 'published' ${where}
    ORDER BY p.sort_order, p.code;`;
}

export async function listPublishedPlaces(opts: { lang: string; zone?: string; q?: string }): Promise<PublicPlaceRow[]> {
  const pool = await getPool();
  const req = pool.request().input("lang", sql.VarChar(10), opts.lang);
  let where = "";
  if (opts.zone) {
    req.input("zone", sql.VarChar(12), opts.zone);
    where += " AND p.zone = @zone";
  }
  if (opts.q) {
    // Tìm theo số điểm, tiêu đề hoặc tóm tắt của bài đang hiển thị. Ký tự đặc biệt của LIKE được thoát.
    req.input("q", sql.NVarChar(102), `%${opts.q.replace(/[[%_]/g, "[$&]")}%`);
    where += " AND (p.code LIKE @q OR c.title LIKE @q OR c.summary LIKE @q)";
  }
  return (await req.query<PublicPlaceRow>(placeQuery(where, false))).recordset;
}

export async function findPublishedPlaceByCode(code: string, lang: string): Promise<PublicPlaceRow | undefined> {
  const pool = await getPool();
  const r = await pool.request().input("lang", sql.VarChar(10), lang).input("code", sql.Char(3), code)
    .query<PublicPlaceRow>(placeQuery("AND p.code = @code", true));
  return r.recordset[0];
}

export async function allPublishedPlacesWithBody(lang: string): Promise<PublicPlaceRow[]> {
  const pool = await getPool();
  const r = await pool.request().input("lang", sql.VarChar(10), lang).query<PublicPlaceRow>(placeQuery("", true));
  return r.recordset;
}

// Các ngôn ngữ (đang bật) có bài hiển thị được cho một điểm – để màn hình chi tiết cho đổi ngôn ngữ.
export async function placeLanguages(placeId: number): Promise<string[]> {
  const pool = await getPool();
  const r = await pool.request().input("id", sql.Int, placeId).query<{ code: string }>(`
    SELECT c.language_code AS code
    FROM dbo.place_contents c JOIN dbo.languages l ON l.code = c.language_code
    WHERE c.place_id = @id AND ${VISIBLE_CONTENT} AND l.is_enabled = 1
    ORDER BY l.sort_order, l.code;`);
  return r.recordset.map((x) => x.code);
}

export async function currentVersion(): Promise<{ version: number; publishedAt: Date | null }> {
  const pool = await getPool();
  const r = await pool.request().query<{ version: number | null; published_at: Date | null }>(`
    SELECT TOP (1) version, published_at FROM dbo.content_releases ORDER BY version DESC;`);
  const row = r.recordset[0];
  return { version: row?.version ?? 0, publishedAt: row?.published_at ?? null };
}
