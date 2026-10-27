import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import type { ContentBundle } from "./api";

// Nơi lưu trên máy (PRD v1.0, mục 4.6.2): gói nội dung trong documentDirectory/bundles/{lang}.json,
// âm thanh trong documentDirectory/audio/{lang}/, cài đặt và lượt ghé chưa gửi trong AsyncStorage.

export async function getJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function setJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export interface StoredBundle {
  bundle: ContentBundle;
  etag: string | null;
  savedAt: string;
  // URL âm thanh trên máy chủ → tệp đã tải về máy
  audioFiles: Record<string, string>;
}

function bundleFile(lang: string): File {
  return new File(Paths.document, "bundles", `${lang}.json`);
}

export async function loadBundle(lang: string): Promise<StoredBundle | null> {
  try {
    const f = bundleFile(lang);
    if (!f.exists) return null;
    return JSON.parse(await f.text()) as StoredBundle;
  } catch {
    return null;
  }
}

export async function saveBundle(stored: StoredBundle): Promise<void> {
  const dir = new Directory(Paths.document, "bundles");
  if (!dir.exists) dir.create({ intermediates: true });
  const f = bundleFile(stored.bundle.lang);
  if (!f.exists) f.create();
  await f.write(JSON.stringify(stored));
}

export function listDownloadedLanguages(): { lang: string; bytes: number }[] {
  try {
    return listDownloaded();
  } catch {
    return []; // trình duyệt (bản xem trước web) không có hệ thống tệp
  }
}

function listDownloaded(): { lang: string; bytes: number }[] {
  const dir = new Directory(Paths.document, "bundles");
  if (!dir.exists) return [];
  return dir.list().flatMap((entry) => {
    if (!(entry instanceof File) || !entry.name.endsWith(".json")) return [];
    const lang = entry.name.replace(/\.json$/, "");
    const audio = new Directory(Paths.document, "audio", lang);
    const audioBytes = audio.exists ? audio.list().reduce((s, f) => s + (f instanceof File ? f.size : 0), 0) : 0;
    return [{ lang, bytes: entry.size + audioBytes }];
  });
}

// Tải tệp âm thanh của một ngôn ngữ để nghe offline. Trả về bản đồ URL → URI tệp cục bộ.
export async function downloadAudio(
  lang: string,
  urls: { url: string; name: string }[],
  onProgress: (done: number, total: number) => void,
): Promise<Record<string, string>> {
  const dir = new Directory(Paths.document, "audio", lang);
  if (!dir.exists) dir.create({ intermediates: true });
  const out: Record<string, string> = {};
  for (const [i, { url, name }] of urls.entries()) {
    const target = new File(dir, name);
    if (target.exists) target.delete();
    const file = await File.downloadFileAsync(url, target);
    out[url] = file.uri;
    onProgress(i + 1, urls.length);
  }
  return out;
}

export function deleteLanguageData(lang: string): void {
  for (const d of [new Directory(Paths.document, "audio", lang)]) if (d.exists) d.delete();
  const f = bundleFile(lang);
  if (f.exists) f.delete();
}
