// npm run dev (trong thư mục api): chạy cả hệ thống để demo bằng MỘT lệnh.
//   [api]    API (tsx watch, tự tải lại khi sửa code)        http://localhost:3000
//   [web]    Web User (Vite)                                  http://localhost:5173
//   [admin]  Web Admin (Vite)                                 http://localhost:5174
//   [tunnel] Cloudflare Quick Tunnel → link https://….trycloudflare.com cho khách dùng 4G quét QR
// Link tunnel đổi mỗi lần chạy: script ghi vào api/.tunnel-url, API đọc tệp này để tạo mã QR "Mời tham gia"
// (không cần sửa .env). Ctrl + C: tắt tất cả, xóa tệp link.
// Tùy chọn: npm run dev -- --no-tunnel (chỉ dùng trong Wi-Fi) · npm run dev:api (chỉ chạy API).
// npm run demo (= --open-guests): chạy xong tự mở Web Admin + các tab khách ảo, mỗi tab một địa chỉ khác nhau
// (localhost, 127.0.0.1, IP Wi-Fi, link tunnel) → trình duyệt tách cookie theo địa chỉ nên mỗi tab là một khách riêng.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = path.resolve(apiDir, "..");
const tunnelFile = path.join(apiDir, ".tunnel-url");
const isWin = process.platform === "win32";
const withTunnel = !process.argv.includes("--no-tunnel");
const openGuests = process.argv.includes("--open-guests");

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
// Mở link bằng trình duyệt mặc định của máy
function openBrowser(url) {
  const [cmd, args] = isWin ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  const child = spawn(cmd, args, { stdio: "ignore", detached: true });
  child.on("error", () => say(`Không mở được trình duyệt – hãy tự mở: ${url}`));
  child.unref();
}

// Đợi đến khi url trả lời 2xx (tối đa timeoutMs); true = sẵn sàng
async function waitFor(url, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end && !stopping) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(3000) })).ok) return true;
    } catch {
      // chưa chạy xong
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

// IP Wi-Fi/LAN nội bộ (bỏ card ảo Docker, WSL, VPN…) – giống cách chọn trong src/modules/admin/joinLink.ts
function lanIp() {
  const virtual = /docker|^br-|veth|vethernet|wsl|hyper-v|virtualbox|vmware|vbox|radmin|zerotier|tailscale|hamachi|loopback/i;
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    if (virtual.test(name)) continue;
    const a = (addrs ?? []).find((x) => x.family === "IPv4" && !x.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(x.address));
    if (a) return a.address;
  }
  return null;
}

let tunnelReady = null; // Promise<string | null>: link tunnel khi đã truy cập được
const guestCount = { n: 0 };
function openGuest(url) {
  guestCount.n += 1;
  say(`  Khách ảo #${guestCount.n}: ${url}`);
  openBrowser(url);
}

async function openDemoTabs() {
  const ready = (await waitFor("http://localhost:3000/health", 90_000)) && (await waitFor("http://localhost:5173", 90_000));
  if (!ready) return say("API/Web chưa chạy được nên không tự mở trình duyệt – xem lỗi phía trên.");
  await waitFor("http://localhost:5174", 30_000);
  say("\nMở Web Admin và các tab khách ảo (mỗi tab là một khách riêng):");
  openBrowser("http://localhost:5174");
  openGuest("http://localhost:5173");
  openGuest("http://127.0.0.1:5173");
  const ip = lanIp();
  if (ip) openGuest(`http://${ip}:5173`);
  const tunnel = await tunnelReady;
  if (tunnel) openGuest(tunnel);
  say(`→ ${guestCount.n} khách ảo. Cần thêm: mở Chrome ẩn danh / Edge rồi dán một trong các link trên, hoặc dùng điện thoại quét QR.\n`);
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
    let found;
    tunnelReady = new Promise((resolve) => (found = resolve));
    setTimeout(() => found(null), 90_000); // tunnel lỗi / mạng chặn → vẫn mở các tab còn lại
    const child = start("tunnel", cloudflared, ["tunnel", "--url", "http://localhost:5173", "--no-autoupdate"], apiDir, (line) => {
      const m = line.match(/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/);
      if (!m || announced) return;
      announced = true;
      writeFileSync(tunnelFile, `${m[0]}\n`);
      const bar = "=".repeat(m[0].length + 8);
      say(`\n${bar}\n  LINK CÔNG KHAI (4G vẫn vào được): ${m[0]}\n  Mã QR "Mời tham gia" trên Web Admin đã tự dùng link này.\n${bar}\n`);
      // Link vừa in ra thường cần vài giây mới truy cập được → chỉ mở tab khi link đã trả lời
      if (openGuests) void waitFor(m[0], 45_000).then((ok) => found(ok ? `${m[0]}/` : null));
    });
    child.on("exit", () => found(null));
  }
}

say("Web User: http://localhost:5173 · Web Admin: http://localhost:5174 · Swagger: http://localhost:3000/api/docs");
if (openGuests) void openDemoTabs();
