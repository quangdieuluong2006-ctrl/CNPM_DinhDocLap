import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AI_VOICES,
  type AudioManifest,
  audioFile,
  audioKey,
  durationFromBytes,
  type NarrationText,
  readManifest,
  spokenText,
  textHash,
} from "./aiVoice.js";

// Sinh tệp giọng đọc AI cho mọi bài trong db/seed (PRD v2.0, mục 4.10).
//   npm run gen:audio                 → chỉ sinh tệp thiếu hoặc bài đã đổi văn bản/giọng
//   npm run gen:audio -- --force      → sinh lại tất cả
//   npm run gen:audio -- --only en/201,vi → chỉ một số bài (lang/code) hoặc cả một ngôn ngữ
// Cần công cụ edge-tts (mã nguồn mở, Python): pip install edge-tts
// Lưu ý: edge-tts dùng dịch vụ đọc của trình duyệt Microsoft Edge, không phải API thương mại – chỉ dùng cho học tập (PRD 15.4).

const here = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = process.env.SEED_DIR ?? path.resolve(here, "../../../db/seed");
const AUDIO_DIR = path.join(SEED_DIR, "audio");

interface SeedPlace extends Record<string, unknown> {
  code: string;
  vi: NarrationText;
  en: NarrationText;
}

// Mọi bài trong dữ liệu mẫu: vi/en trong places.vi-en.json, 8 ngôn ngữ còn lại trong places.i18n.json.
export function seedTexts(seedDir = SEED_DIR): { lang: string; code: string; text: NarrationText }[] {
  const { places } = JSON.parse(readFileSync(path.join(seedDir, "places.vi-en.json"), "utf8")) as { places: SeedPlace[] };
  const i18n = JSON.parse(readFileSync(path.join(seedDir, "places.i18n.json"), "utf8")) as Record<string, unknown>;
  const out: { lang: string; code: string; text: NarrationText }[] = [];
  for (const p of places) {
    out.push({ lang: "vi", code: p.code, text: p.vi }, { lang: "en", code: p.code, text: p.en });
    const more = i18n[p.code];
    if (more && typeof more === "object") {
      for (const [lang, t] of Object.entries(more as Record<string, NarrationText>)) out.push({ lang, code: p.code, text: t });
    }
  }
  return out;
}

// Gọi edge-tts. Thử lần lượt các cách gọi vì trên Windows thư mục Scripts của Python có thể chưa nằm trong PATH.
const RUNNERS: string[][] = [["edge-tts"], ["python", "-m", "edge_tts"], ["py", "-m", "edge_tts"], ["python3", "-m", "edge_tts"]];
let runner: string[] | undefined;

function run(cmd: string[], args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd[0]!, [...cmd.slice(1), ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("error", (e) => resolve({ code: -1, stderr: e.message }));
    child.on("close", (code) => resolve({ code: code ?? -1, stderr }));
  });
}

async function findRunner(): Promise<string[]> {
  for (const r of RUNNERS) if ((await run(r, ["--version"])).code === 0) return r;
  throw new Error("Không tìm thấy edge-tts. Cài bằng: pip install edge-tts (cần Python 3.9+), rồi chạy lại.");
}

async function synthesize(voice: string, text: string, out: string): Promise<void> {
  runner ??= await findRunner();
  const tmp = `${out}.tmp`;
  const textFile = `${out}.txt`;
  writeFileSync(textFile, text, "utf8"); // truyền qua tệp: tránh lỗi dấu và độ dài dòng lệnh trên Windows
  const proxy = process.env.HTTPS_PROXY ? ["--proxy", process.env.HTTPS_PROXY] : [];
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const r = await run(runner, ["--voice", voice, "--file", textFile, "--write-media", tmp, ...proxy]);
      if (r.code === 0 && existsSync(tmp) && statSync(tmp).size > 1000) {
        writeFileSync(out, readFileSync(tmp));
        return;
      }
      if (attempt === 3) throw new Error(r.stderr.trim().split("\n").pop() || `edge-tts thoát với mã ${r.code}`);
      await new Promise((res) => setTimeout(res, 2000 * attempt)); // dịch vụ đôi khi từ chối khi gọi dồn dập
    }
  } finally {
    rmSync(tmp, { force: true });
    rmSync(textFile, { force: true });
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const onlyArg = args[args.indexOf("--only") + 1];
  const only = args.includes("--only") && onlyArg ? onlyArg.split(",").map((s) => s.trim()) : null;

  const manifest: AudioManifest = readManifest(AUDIO_DIR);
  const items = seedTexts().filter((i) => !only || only.includes(i.lang) || only.includes(audioKey(i.lang, i.code)));
  let made = 0;
  let kept = 0;
  for (const { lang, code, text } of items) {
    const voice = AI_VOICES[lang];
    if (!voice) {
      console.warn(`Bỏ qua ${lang}/${code}: chưa chọn giọng cho ngôn ngữ "${lang}" (AI_VOICES trong src/db/aiVoice.ts).`);
      continue;
    }
    const key = audioKey(lang, code);
    const file = audioFile(AUDIO_DIR, lang, code);
    const hash = textHash(voice, text);
    if (!force && manifest[key]?.hash === hash && existsSync(file)) {
      kept++;
      continue;
    }
    mkdirSync(path.dirname(file), { recursive: true });
    process.stdout.write(`Đang đọc ${key} (${voice})… `);
    await synthesize(voice, spokenText(text), file);
    const bytes = statSync(file).size;
    manifest[key] = { hash, voice, bytes, durationSec: durationFromBytes(bytes) };
    // Ghi manifest sau mỗi tệp: dừng giữa chừng (mất mạng, Ctrl+C) thì lần sau chạy tiếp từ chỗ dừng.
    writeFileSync(path.join(AUDIO_DIR, "manifest.json"), `${JSON.stringify(sortKeys(manifest), null, 2)}\n`);
    console.log(`${Math.round(bytes / 1024)} KB, ${manifest[key].durationSec} giây`);
    made++;
  }
  const total = Object.values(manifest).reduce((s, m) => s + m.bytes, 0);
  console.log(`Xong: sinh mới ${made}, giữ nguyên ${kept}. Tổng ${Object.keys(manifest).length} tệp, ${(total / 1024 / 1024).toFixed(1)} MB.`);
  if (made > 0) console.log("Chạy npm run db:seed để gắn tệp mới vào CSDL.");
}

function sortKeys(m: AudioManifest): AudioManifest {
  return Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err: unknown) => {
    console.error(`\nSinh giọng đọc thất bại: ${(err as Error).message}`);
    process.exit(1);
  });
}
