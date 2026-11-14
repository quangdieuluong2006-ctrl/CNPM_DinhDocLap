import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { mediaRoot } from "../lib/media.js";
import { AI_VOICES, audioFile, readManifest, textHash } from "./aiVoice.js";
import { dbConfig, sql } from "./pool.js";

// Dữ liệu mẫu cho môi trường dev/demo (PRD v2.0, mục 13.4). Chạy lại nhiều lần vẫn an toàn.
const SEED_DIR = process.env.SEED_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../db/seed");

// [mã, tên tiếng Việt, tên tiếng Anh, tên bản ngữ, locale giọng đọc]
export const LANGUAGES: [string, string, string, string, string][] = [
  ["vi", "Tiếng Việt", "Vietnamese", "Tiếng Việt", "vi-VN"],
  ["en", "Tiếng Anh", "English", "English", "en-US"],
  ["zh", "Tiếng Trung (giản thể)", "Chinese (Simplified)", "中文", "zh-CN"],
  ["ko", "Tiếng Hàn", "Korean", "한국어", "ko-KR"],
  ["ja", "Tiếng Nhật", "Japanese", "日本語", "ja-JP"],
  ["fr", "Tiếng Pháp", "French", "Français", "fr-FR"],
  ["de", "Tiếng Đức", "German", "Deutsch", "de-DE"],
  ["ru", "Tiếng Nga", "Russian", "Русский", "ru-RU"],
  ["es", "Tiếng Tây Ban Nha", "Spanish", "Español", "es-ES"],
  ["th", "Tiếng Thái", "Thai", "ไทย", "th-TH"],
];

// Chỉ quản trị viên có email/mật khẩu (PRD v2.0, mục 2.2). Khách luôn là khách ẩn danh.
export const DEMO_USERS = [{ email: "admin@demo.vn", fullName: "Quản trị viên", role: "admin" }] as const;

// Khách ẩn danh mẫu (is_guest = 1, không mật khẩu) để Dashboard và trang Người dùng có dữ liệu.
// Email theo đúng dạng API tự sinh cho khách: guest-…@guest.local.
export const SAMPLE_GUESTS = [
  { email: "guest-sample-1@guest.local", fullName: "Khách #7F3A", lang: "en" },
  { email: "guest-sample-2@guest.local", fullName: "Khách #B21C", lang: "vi" },
  { email: "guest-sample-3@guest.local", fullName: "Khách #4E9D", lang: "ko" },
  { email: "guest-sample-4@guest.local", fullName: "Khách #C058", lang: "ja" },
  { email: "guest-sample-5@guest.local", fullName: "Khách #19F2", lang: "zh" },
  { email: "guest-sample-6@guest.local", fullName: "Khách #E7A4", lang: "fr" },
] as const;

// Tài khoản mẫu của bản trước v2.0 (hướng dẫn viên, người dùng có mật khẩu): seed xóa nếu còn trong CSDL.
export const LEGACY_DEMO_EMAILS = [
  "guide1@demo.vn", "guide2@demo.vn",
  "user1@demo.vn", "user2@demo.vn", "user3@demo.vn", "user4@demo.vn", "user5@demo.vn", "user6@demo.vn",
];

interface Text {
  title: string;
  summary: string;
  body: string;
}
interface SeedPlace {
  code: string;
  slug: string;
  internalName: string;
  trigger: "gps" | "indoor";
  zone: string;
  lat: number;
  lng: number;
  radiusM: number;
  sortOrder: number;
  priority: number;
  vi: Text;
  en: Text;
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(SEED_DIR, file), "utf8")) as T;
}

// Bộ sinh số giả ngẫu nhiên cố định để mỗi lần seed ra cùng dữ liệu.
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
}

export async function seed(log: (msg: string) => void = console.log): Promise<void> {
  const { places } = readJson<{ places: SeedPlace[] }>("places.vi-en.json");
  const i18n = readJson<Record<string, Record<string, Text>>>("places.i18n.json");

  const pool = await new sql.ConnectionPool(dbConfig()).connect();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  const req = () => new sql.Request(tx);
  try {
    for (const [i, [code, nameVi, nameEn, nameNative, tts]] of LANGUAGES.entries()) {
      await req()
        .input("code", sql.VarChar(10), code)
        .input("vi", sql.NVarChar(60), nameVi)
        .input("en", sql.NVarChar(60), nameEn)
        .input("native", sql.NVarChar(60), nameNative)
        .input("tts", sql.VarChar(20), tts)
        .input("sort", sql.Int, i + 1).query(`
          MERGE dbo.languages AS t USING (SELECT @code AS code) AS s ON t.code = s.code
          WHEN MATCHED THEN UPDATE SET name_vi = @vi, name_en = @en, name_native = @native, tts_locale = @tts, sort_order = @sort
          WHEN NOT MATCHED THEN INSERT (code, name_vi, name_en, name_native, tts_locale, sort_order)
               VALUES (@code, @vi, @en, @native, @tts, @sort);`);
    }

    // Quản trị viên mẫu dùng SEED_PASSWORD (mặc định Demo@12345); chỉ tạo nếu chưa có.
    const passwordHash = await bcrypt.hash(env.SEED_PASSWORD, 10);
    for (const u of DEMO_USERS) {
      await req()
        .input("email", sql.NVarChar(255), u.email)
        .input("hash", sql.NVarChar(255), passwordHash)
        .input("name", sql.NVarChar(100), u.fullName)
        .input("role", sql.VarChar(10), u.role).query(`
          IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = @email)
            INSERT INTO dbo.users (email, password_hash, full_name, role, narration_lang)
            VALUES (@email, @hash, @name, @role, 'vi');`);
    }
    for (const g of SAMPLE_GUESTS) {
      await req()
        .input("email", sql.NVarChar(255), g.email)
        .input("name", sql.NVarChar(100), g.fullName)
        .input("lang", sql.VarChar(10), g.lang).query(`
          IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = @email)
            INSERT INTO dbo.users (email, password_hash, full_name, role, narration_lang, is_guest)
            VALUES (@email, NULL, @name, 'user', @lang, 1);`);
    }

    // Xóa tài khoản mẫu cũ. visits, activity_logs, place_contents, content_releases tham chiếu users
    // mà không có ON DELETE CASCADE, nên gán NULL trước (giữ lại lượt ghé, nhật ký) rồi mới xóa;
    // refresh_tokens và user_sessions tự xóa theo (ON DELETE CASCADE).
    const legacy = req();
    LEGACY_DEMO_EMAILS.forEach((e, i) => legacy.input(`e${i}`, sql.NVarChar(255), e));
    const removed = await legacy.query<{ n: number }>(`
      DECLARE @old TABLE (id INT PRIMARY KEY);
      INSERT INTO @old SELECT id FROM dbo.users WHERE email IN (${LEGACY_DEMO_EMAILS.map((_, i) => `@e${i}`).join(", ")});
      UPDATE dbo.visits           SET user_id = NULL      WHERE user_id      IN (SELECT id FROM @old);
      UPDATE dbo.activity_logs    SET user_id = NULL      WHERE user_id      IN (SELECT id FROM @old);
      UPDATE dbo.place_contents   SET updated_by = NULL   WHERE updated_by   IN (SELECT id FROM @old);
      UPDATE dbo.content_releases SET published_by = NULL WHERE published_by IN (SELECT id FROM @old);
      DELETE FROM dbo.users WHERE id IN (SELECT id FROM @old);
      SELECT COUNT(*) AS n FROM @old;`);
    const removedLegacy = removed.recordset[0]!.n;

    for (const p of places) {
      await req()
        .input("code", sql.Char(3), p.code)
        .input("slug", sql.VarChar(80), p.slug)
        .input("name", sql.NVarChar(120), p.internalName)
        .input("trigger", sql.VarChar(10), p.trigger)
        .input("zone", sql.VarChar(12), p.zone)
        .input("lat", sql.Decimal(9, 6), p.lat)
        .input("lng", sql.Decimal(9, 6), p.lng)
        .input("radius", sql.SmallInt, p.radiusM)
        .input("priority", sql.SmallInt, p.priority)
        .input("sort", sql.Int, p.sortOrder).query(`
          MERGE dbo.places AS t USING (SELECT @code AS code) AS s ON t.code = s.code
          WHEN MATCHED THEN UPDATE SET slug = @slug, internal_name = @name, trigger_type = @trigger, zone = @zone,
               lat = @lat, lng = @lng, radius_m = @radius, priority = @priority, sort_order = @sort
          WHEN NOT MATCHED THEN INSERT (code, slug, internal_name, trigger_type, zone, lat, lng, radius_m, priority, sort_order, status)
               VALUES (@code, @slug, @name, @trigger, @zone, @lat, @lng, @radius, @priority, @sort, 'published');`);

      // vi/en do người viết, đã duyệt; các ngôn ngữ khác là bản dịch chờ duyệt.
      const texts: [string, Text, "approved" | "pending", "human" | "machine"][] = [
        ["vi", p.vi, "approved", "human"],
        ["en", p.en, "approved", "human"],
        ...Object.entries(i18n[p.code] ?? {}).map(([lang, t]) => [lang, t, "pending", "machine"] as [string, Text, "pending", "machine"]),
      ];
      for (const [lang, t, status, source] of texts) {
        await req()
          .input("code", sql.Char(3), p.code)
          .input("lang", sql.VarChar(10), lang)
          .input("title", sql.NVarChar(120), t.title)
          .input("summary", sql.NVarChar(300), t.summary)
          .input("body", sql.NVarChar(sql.MAX), t.body)
          .input("status", sql.VarChar(10), status)
          .input("source", sql.VarChar(10), source).query(`
            DECLARE @placeId INT = (SELECT id FROM dbo.places WHERE code = @code);
            IF NOT EXISTS (SELECT 1 FROM dbo.place_contents WHERE place_id = @placeId AND language_code = @lang)
              INSERT INTO dbo.place_contents (place_id, language_code, title, summary, body, status, source)
              VALUES (@placeId, @lang, @title, @summary, @body, @status, @source);`);
      }
    }

    // Giọng đọc AI (PRD v2.0, mục 4.10): gắn db/seed/audio/<lang>/<code>.mp3 vào bài tương ứng.
    const hadRelease = (await req().query<{ n: number }>("SELECT COUNT(*) AS n FROM dbo.content_releases")).recordset[0]!.n > 0;
    const voice = await attachAiVoices(req);
    // CSDL đã có từ trước mà giọng đọc thay đổi → tăng phiên bản để ứng dụng tải lại gói nội dung (ETag đổi).
    if (hadRelease && voice.attached + voice.detached > 0) {
      await req().input("note", sql.NVarChar(300), `Giọng đọc AI: gắn ${voice.attached}, gỡ ${voice.detached} tệp`)
        .query("INSERT INTO dbo.content_releases (note) VALUES (@note);");
    }

    await req().query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.content_releases)
        INSERT INTO dbo.content_releases (note) VALUES (N'Dữ liệu mẫu ban đầu');`);

    // Lượt ghé mẫu 7 ngày để Dashboard có dữ liệu – chỉ tạo khi bảng còn trống.
    const existing = await req().query<{ n: number }>("SELECT COUNT(*) AS n FROM dbo.visits");
    if (existing.recordset[0]!.n === 0) {
      const ids = await req().query<{ id: number; email: string }>("SELECT id, email FROM dbo.users WHERE role <> 'admin'");
      const placeIds = await req().query<{ id: number }>("SELECT id FROM dbo.places ORDER BY sort_order");
      const users = ids.recordset;
      const placeList = placeIds.recordset.map((r) => r.id);
      const langs = ["vi", "vi", "vi", "en", "en", "zh", "ko", "ja", "fr", "de"];
      const triggers = ["gps", "gps", "qr", "qr", "code", "manual"];
      const rand = rng(20261023);
      for (let i = 0; i < 160; i++) {
        const daysAgo = Math.floor(rand() * 7);
        const minutes = Math.floor(rand() * 600) + 60; // giờ mở cửa xấp xỉ
        const user = users[Math.floor(rand() * users.length)]!;
        const placeId = placeList[Math.floor(rand() * placeList.length)]!;
        const listened = 30 + Math.floor(rand() * 120);
        await req()
          .input("user", sql.Int, rand() < 0.2 ? null : user.id) // 20% lượt ghé không gắn khách (dữ liệu cũ, khách đã xóa)
          .input("place", sql.Int, placeId)
          .input("lang", sql.VarChar(10), langs[Math.floor(rand() * langs.length)])
          .input("trigger", sql.VarChar(10), triggers[Math.floor(rand() * triggers.length)])
          .input("listened", sql.Int, listened)
          .input("completed", sql.Bit, rand() < 0.7)
          .input("days", sql.Int, daysAgo)
          .input("minutes", sql.Int, minutes).query(`
            INSERT INTO dbo.visits (client_id, user_id, place_id, language_code, trigger_type, listened_sec, completed, started_at)
            VALUES (NEWID(), @user, @place, @lang, @trigger, @listened, @completed,
                    DATEADD(MINUTE, -@minutes, DATEADD(DAY, -@days, SYSUTCDATETIME())));`);
      }
    }

    await tx.commit();
    log(
      `Đã nạp dữ liệu mẫu: ${LANGUAGES.length} ngôn ngữ, ${DEMO_USERS.length} quản trị viên, ${SAMPLE_GUESTS.length} khách mẫu, ` +
        `${places.length} điểm thuyết minh, giọng đọc AI ${voice.ready}/${voice.total} bài` +
        (voice.attached || voice.detached ? ` (gắn mới ${voice.attached}, gỡ ${voice.detached})` : "") +
        (voice.skipped ? `, ${voice.skipped} bài đã sửa văn bản nên không gắn` : "") +
        (removedLegacy ? `; đã xóa ${removedLegacy} tài khoản mẫu cũ.` : "."),
    );
  } catch (err) {
    await tx.rollback();
    throw err;
  } finally {
    await pool.close();
  }
}

// Gắn tệp giọng đọc AI vào place_contents. Chỉ gắn khi văn bản trong CSDL khớp đúng văn bản đã dùng để sinh tệp
// (so mã băm trong manifest.json) – bài đã được sửa trên Web Admin sẽ không bị gắn giọng đọc cũ.
// Không đụng tới bài đang dùng tệp do quản trị viên tự tải lên. Tệp được chép vào MEDIA_DIR/audio/<lang>/<code>-ai.mp3.
async function attachAiVoices(req: () => sql.Request) {
  const audioDir = path.join(SEED_DIR, "audio");
  const manifest = readManifest(audioDir);
  const rows = await req().query<{ code: string; lang: string; title: string; body: string; audio_url: string | null }>(`
    SELECT p.code, c.language_code AS lang, c.title, c.body, c.audio_url
    FROM dbo.place_contents c JOIN dbo.places p ON p.id = c.place_id`);
  const result = { total: rows.recordset.length, ready: 0, attached: 0, detached: 0, skipped: 0 };
  for (const r of rows.recordset) {
    const url = `/media/audio/${r.lang}/${r.code}-ai.mp3`;
    const entry = manifest[`${r.lang}/${r.code}`];
    const voice = AI_VOICES[r.lang];
    const src = audioFile(audioDir, r.lang, r.code);
    const ours = r.audio_url === null || r.audio_url === url; // không ghi đè tệp quản trị viên tải lên
    if (!ours) continue;
    const matches = !!entry && !!voice && entry.voice === voice && entry.hash === textHash(voice, r) && existsSync(src);
    if (matches) {
      const dest = path.join(mediaRoot, "audio", r.lang, `${r.code}-ai.mp3`);
      if (!existsSync(dest) || statSync(dest).size !== entry.bytes) {
        mkdirSync(path.dirname(dest), { recursive: true });
        copyFileSync(src, dest);
      }
      if (r.audio_url !== url) {
        await req().input("code", sql.Char(3), r.code).input("lang", sql.VarChar(10), r.lang)
          .input("url", sql.NVarChar(500), url).input("dur", sql.Int, entry.durationSec).input("bytes", sql.Int, entry.bytes).query(`
            UPDATE c SET audio_url = @url, audio_duration_sec = @dur, audio_bytes = @bytes
            FROM dbo.place_contents c JOIN dbo.places p ON p.id = c.place_id
            WHERE p.code = @code AND c.language_code = @lang;`);
        result.attached++;
      }
      result.ready++;
    } else if (r.audio_url === url) {
      // Văn bản đã đổi sau khi sinh giọng → gỡ tệp cũ để không đọc sai nội dung (app dùng giọng thiết bị thay thế).
      await req().input("code", sql.Char(3), r.code).input("lang", sql.VarChar(10), r.lang).query(`
        UPDATE c SET audio_url = NULL, audio_duration_sec = NULL, audio_bytes = NULL
        FROM dbo.place_contents c JOIN dbo.places p ON p.id = c.place_id
        WHERE p.code = @code AND c.language_code = @lang;`);
      result.detached++;
      result.skipped++;
    } else if (entry) {
      result.skipped++;
    }
  }
  return result;
}

// Chạy trực tiếp: npm run db:seed
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seed().catch((err: unknown) => {
    console.error(`Seed thất bại: ${(err as Error).message}`);
    process.exit(1);
  });
}
