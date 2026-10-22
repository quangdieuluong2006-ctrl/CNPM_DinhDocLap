import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../../lib/apiError.js";
import { langSchema, placeCodeSchema, ZONES } from "./content.schemas.js";
import { toLanguageDto, toPlaceDto } from "./content.dto.js";
import * as repo from "./content.repository.js";

// API nội dung công khai: khách không cần đăng nhập vẫn nghe thuyết minh (PRD v1.0, mục 11.2).
export const contentRouter = Router();


contentRouter.get("/languages", async (_req, res) => {
  const rows = await repo.listPublicLanguages();
  res.json({ items: rows.map(toLanguageDto) });
});

const listQuery = z.object({
  lang: langSchema.default("vi"),
  zone: z.enum(ZONES).optional(),
  q: z.string().trim().max(100).optional(),
});

contentRouter.get("/places", async (req, res) => {
  const q = listQuery.parse(req.query);
  const rows = await repo.listPublishedPlaces({ lang: q.lang, zone: q.zone, q: q.q || undefined });
  res.json({ lang: q.lang, items: rows.map((r) => toPlaceDto(r, q.lang, false)) });
});

// Dùng cho QR (https://<web-user>/p/{code}) và bàn phím nhập số điểm.
contentRouter.get("/places/:code", async (req, res) => {
  const code = placeCodeSchema.parse(req.params.code);
  const { lang } = z.object({ lang: langSchema.default("vi") }).parse(req.query);
  const row = await repo.findPublishedPlaceByCode(code, lang);
  if (!row) throw new ApiError(404, "PLACE_NOT_FOUND", `Không có điểm thuyết minh số ${code}`);
  res.json({ ...toPlaceDto(row, lang, true), languages: await repo.placeLanguages(row.id) });
});

contentRouter.get("/content/version", async (_req, res) => {
  res.json(await repo.currentVersion());
});

// Gói offline: toàn bộ điểm đã xuất bản + bài đầy đủ của một ngôn ngữ. ETag đổi khi admin xuất bản phiên bản mới.
contentRouter.get("/content/bundle", async (req, res) => {
  const { lang } = z.object({ lang: langSchema.default("vi") }).parse(req.query);
  const { version, publishedAt } = await repo.currentVersion();
  const etag = `"v${version}-${lang}"`;
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", "no-cache"); // luôn hỏi lại máy chủ, nhưng nhận 304 nếu không đổi
  if (req.get("if-none-match") === etag) {
    res.status(304).end();
    return;
  }
  const language = await repo.getLanguage(lang);
  const rows = await repo.allPublishedPlacesWithBody(lang);
  const places = rows.map((r) => toPlaceDto(r, lang, true));
  res.json({
    version,
    publishedAt,
    lang,
    ttsLocale: language?.tts_locale ?? null,
    places,
    totalAudioBytes: places.reduce((sum, p) => sum + (p.content?.audioBytes ?? 0), 0),
  });
});
