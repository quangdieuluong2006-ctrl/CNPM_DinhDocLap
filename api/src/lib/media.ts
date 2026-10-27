import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { env } from "../config/env.js";
import { ApiError } from "./apiError.js";

// Tệp tải lên lưu ở MEDIA_DIR và được phục vụ tại /media/... (express.static hỗ trợ HTTP Range để tua).
export const mediaRoot = path.resolve(env.MEDIA_DIR);

const AUDIO_TYPES: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
};
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function uploader(types: Record<string, string>, maxMb: number) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (types[file.mimetype]) cb(null, true);
      else cb(new ApiError(415, "UNSUPPORTED_MEDIA", `Định dạng ${file.mimetype} không được hỗ trợ (chỉ ${[...new Set(Object.values(types))].join(", ")})`));
    },
  }).single("file");
}

export const uploadAudio = uploader(AUDIO_TYPES, env.MAX_AUDIO_MB);
export const uploadImage = uploader(IMAGE_TYPES, env.MAX_IMAGE_MB);

// Lưu tệp với tên ngẫu nhiên (không dùng tên gốc từ client) → trả URL công khai /media/<thư mục>/<tệp>.
export async function saveMedia(file: Express.Multer.File | undefined, folder: string, prefix: string): Promise<string> {
  if (!file) throw new ApiError(400, "VALIDATION_ERROR", "Thiếu tệp (trường form \"file\")");
  const ext = AUDIO_TYPES[file.mimetype] ?? IMAGE_TYPES[file.mimetype];
  if (!ext) throw new ApiError(415, "UNSUPPORTED_MEDIA", "Định dạng tệp không được hỗ trợ");
  const name = `${prefix}-${Date.now()}-${randomBytes(3).toString("hex")}.${ext}`;
  const dir = path.join(mediaRoot, folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), file.buffer);
  return `/media/${folder}/${name}`;
}

// Xóa tệp cũ khi thay/xóa. Chỉ xóa đường dẫn nằm trong mediaRoot.
export async function removeMedia(url: string | null | undefined): Promise<void> {
  if (!url?.startsWith("/media/")) return;
  const full = path.resolve(mediaRoot, url.slice("/media/".length));
  if (!full.startsWith(mediaRoot + path.sep)) return;
  await rm(full, { force: true });
}
