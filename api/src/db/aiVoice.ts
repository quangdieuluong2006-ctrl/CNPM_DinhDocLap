import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Giọng đọc AI (PRD v2.0, mục 4.10): mỗi bài thuyết minh có một tệp MP3 sinh sẵn bằng giọng neural,
// lưu trong db/seed/audio/<lang>/<code>.mp3 và được seed gắn vào place_contents.
// Dùng chung cho script sinh tệp (gen-audio.ts) và seed.ts.

// Giọng neural theo ngôn ngữ (Phụ lục B của PRD). Đổi giọng → mã băm đổi → script sinh lại tệp.
export const AI_VOICES: Record<string, string> = {
  vi: "vi-VN-HoaiMyNeural",
  en: "en-US-JennyNeural",
  zh: "zh-CN-XiaoxiaoNeural",
  ko: "ko-KR-SunHiNeural",
  ja: "ja-JP-NanamiNeural",
  fr: "fr-FR-DeniseNeural",
  de: "de-DE-KatjaNeural",
  ru: "ru-RU-SvetlanaNeural",
  es: "es-ES-ElviraNeural",
  th: "th-TH-PremwadeeNeural",
};

// edge-tts xuất MP3 24 kHz, 48 kbps, mono, tốc độ bit cố định → thời lượng = số byte × 8 / 48 000.
export const AI_AUDIO_BITRATE = 48_000;
export const durationFromBytes = (bytes: number) => Math.max(1, Math.round((bytes * 8) / AI_AUDIO_BITRATE));

export interface NarrationText {
  title: string;
  body: string;
}

// Nội dung được đọc: tiêu đề rồi đến bài. Tóm tắt không đọc vì phần mở đầu của bài đã nói ý đó.
export function spokenText(t: NarrationText): string {
  const title = t.title.trim();
  return `${/[.!?。！？]$/.test(title) ? title : `${title}.`}\n\n${t.body.trim()}`;
}

// Mã băm của (giọng + văn bản): khác nhau nghĩa là tệp MP3 không còn khớp với bài hiện tại.
export function textHash(voice: string, t: NarrationText): string {
  return createHash("sha256").update(`${voice}\n${spokenText(t)}`).digest("hex");
}

export interface ManifestEntry {
  hash: string;
  voice: string;
  bytes: number;
  durationSec: number;
}
// Khóa: "<lang>/<code>", ví dụ "en/201".
export type AudioManifest = Record<string, ManifestEntry>;

export const audioKey = (lang: string, code: string) => `${lang}/${code}`;
export const audioFile = (audioDir: string, lang: string, code: string) => path.join(audioDir, lang, `${code}.mp3`);

export function readManifest(audioDir: string): AudioManifest {
  const file = path.join(audioDir, "manifest.json");
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as AudioManifest) : {};
}
