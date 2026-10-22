import type { PublicLanguageRow, PublicPlaceRow } from "./content.repository.js";

export function toLanguageDto(l: PublicLanguageRow) {
  return {
    code: l.code,
    nameVi: l.name_vi,
    nameEn: l.name_en,
    nameNative: l.name_native,
    ttsLocale: l.tts_locale,
    // Tỷ lệ bài đã duyệt trên số điểm đang xuất bản (0–100).
    completeness: l.published_places > 0 ? Math.round((l.approved * 100) / l.published_places) : 0,
    approved: l.approved,
    pending: l.pending,
  };
}

// requestedLang dùng để đánh dấu isFallback khi bài trả về là ngôn ngữ dự phòng.
export function toPlaceDto(p: PublicPlaceRow, requestedLang: string, withBody: boolean) {
  return {
    id: p.id,
    code: p.code,
    slug: p.slug,
    trigger: p.trigger_type,
    zone: p.zone,
    lat: Number(p.lat),
    lng: Number(p.lng),
    radiusM: p.radius_m,
    priority: p.priority,
    sortOrder: p.sort_order,
    imageUrl: p.image_url,
    content: p.c_lang
      ? {
          lang: p.c_lang,
          isFallback: p.c_lang !== requestedLang,
          title: p.c_title!,
          summary: p.c_summary!,
          ...(withBody ? { body: p.c_body! } : {}),
          status: p.c_status!,
          audioUrl: p.c_audio_url,
          audioDurationSec: p.c_audio_duration_sec,
          audioBytes: p.c_audio_bytes,
        }
      : null,
  };
}
export type PlaceDto = ReturnType<typeof toPlaceDto>;
