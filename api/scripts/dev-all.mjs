// npm run dev (trong thư mục api): chạy cả hệ thống để demo bằng MỘT lệnh.
//   [api]    API (tsx watch, tự tải lại khi sửa code)        http://localhost:3000
//   [web]    Web User (Vite)                                  http://localhost:5173
//   [admin]  Web Admin (Vite)                                 http://localhost:5174
//   [tunnel] Cloudflare Quick Tunnel → link https://….trycloudflare.com cho khách dùng 4G quét QR
// Link tunnel đổi mỗi lần chạy: script ghi vào api/.tunnel-url, API đọc tệp này để tạo mã QR "Mời tham gia"
// (không cần sửa .env). Ctrl + C: tắt tất cả, xóa tệp link.
// Tùy chọn: npm run dev -- --no-tunnel (chỉ dùng trong Wi-Fi) · npm run dev:api (chỉ chạy API).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = path.resolve(apiDir, "..");
const tunnelFile = path.join(apiDir, ".tunnel-url");
const isWin = process.platform === "win32";
const withTunnel = !process.argv.includes("--no-tunnel");

const COLORS = { api: 36, web: 32, admin: 35, tunnel: 33 }; // cyan, xanh lá, tím, vàng
const tag = (name) => `\x1b[${COLORS[name]}m[${name}]\x1b[0m`.padEnd(18);
const say = (msg) => console.log(`\x1b[1m${msg}\x1b[0m`);

const children = [];
let stopping = false;

// Chạy một tiến trình con, in từng dòng kèm nhãn [tên]; onLine để đọc log (tìm link tunnel)
function start(name, command, args, cwd, onLine) {
  const child = spawn(command, args, {
    cwd,
    shell: isWin && command === "npm", // npm trên Windows là npm.cmd → cần shell
    detached: !isWin, // Linux/macOS: tạo nhóm tiến trình riêng để tắt cả cây con
    env: { ...process.env, FORCE_COLOR: "1" },
  });
  const pipe = (stream) => {
    let buf = "";
    stream.on("data", (chunk) => {
      buf += chunk.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) console.log(`${tag(name)} ${line}`);
        onLine?.(line);
      }
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  child.on("exit", (code) => {
    if (!stopping) console.log(`${tag(name)} \x1b[31mđã dừng (mã ${code ?? "?"})\x1b[0m – xem lỗi ngay phía trên`);
  });
  child.on("error", (err) => console.log(`${tag(name)} \x1b[31mkhông chạy được: ${err.message}\x1b[0m`));
  children.push(child);
  return child;
}

// Tìm cloudflared: trong PATH, hoặc thư mục cài mặc định trên Windows (terminal VS Code mở trước khi cài chưa có PATH mới)
function findCloudflared() {
  const candidates = ["cloudflared"];
  if (isWin) {
    candidates.push(
      "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
      "C:\\Program Files\\cloudflared\\cloudflared.exe",
      path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Links", "cloudflared.exe"),
    );
  }
  return candidates.find((c) => spawnSync(c, ["--version"], { stdio: "ignore" }).status === 0) ?? null;
}

function stopAll() {
  if (stopping) return;
  stopping = true;
  say("\nĐang tắt API, Web, Admin, tunnel…");
  rmSync(tunnelFile, { force: true });
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    try {
      if (isWin) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      else process.kill(-child.pid, "SIGTERM");
    } catch {
      // tiến trình đã tự dừng
    }
  }
  setTimeout(() => process.exit(0), 500);
}
process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);

// ---- Khởi động ----
rmSync(tunnelFile, { force: true }); // link của lần chạy trước đã hết hiệu lực

const missing = ["api", "web", "admin"].filter((d) => !existsSync(path.join(rootDir, d, "node_modules")));
if (missing.length) {
  say(`Chưa cài thư viện cho: ${missing.join(", ")} → chạy "npm install" trong từng thư mục đó rồi chạy lại.`);
  process.exit(1);
}

say("Khởi động hệ thống thuyết minh Dinh Độc Lập (Ctrl + C để tắt tất cả)…");
start("api", process.execPath, [path.join(apiDir, "node_modules", "tsx", "dist", "cli.mjs"), "watch", "--env-file-if-exists=.env", "src/server.ts"], apiDir);
start("web", "npm", ["run", "dev"], path.join(rootDir, "web"));
start("admin", "npm", ["run", "dev"], path.join(rootDir, "admin"));

if (withTunnel) {
  const cloudflared = findCloudflared();
  if (!cloudflared) {
    say("Không tìm thấy cloudflared → chỉ chạy trong Wi-Fi. Cài: winget install --id Cloudflare.cloudflared");
  } else {
    let announced = false;
    start("tunnel", cloudflared, ["tunnel", "--url", "http://localhost:5173", "--no-autoupdate"], apiDir, (line) => {
      const m = line.match(/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/);
      if (!m || announced) return;
      announced = true;
      writeFileSync(tunnelFile, `${m[0]}\n`);
      const bar = "=".repeat(m[0].length + 8);
      say(`\n${bar}\n  LINK CÔNG KHAI (4G vẫn vào được): ${m[0]}\n  Mã QR "Mời tham gia" trên Web Admin đã tự dùng link này.\n${bar}\n`);
    });
  }
}

say("Web User: http://localhost:5173 · Web Admin: http://localhost:5174 · Swagger: http://localhost:3000/api/docs");
