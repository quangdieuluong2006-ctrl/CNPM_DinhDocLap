import { readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { env } from "../../config/env.js";

export interface JoinLink {
  url: string;
  label: string; // tên card mạng, giúp chọn đúng Wi-Fi khi máy có nhiều card (VPN, máy ảo…)
  recommended: boolean;
}

// Địa chỉ IPv4 trong mạng nội bộ (Wi-Fi/LAN gia đình, trường học) – RFC 1918.
function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

// Card mạng ảo (Docker, WSL, máy ảo, VPN): điện thoại trong Wi-Fi không truy cập được qua các địa chỉ này.
const VIRTUAL_ADAPTER = /docker|^br-|veth|vethernet|wsl|hyper-v|virtualbox|vmware|vbox|radmin|zerotier|tailscale|hamachi|loopback/i;
const WIFI_ADAPTER = /wi-?fi|wlan|wireless/i;

// Điểm càng cao càng nên dùng cho mã QR: Wi-Fi thật > Ethernet nội bộ > còn lại > card ảo.
function score(name: string, ip: string): number {
  let s = 0;
  if (isPrivateIPv4(ip)) s += 1;
  if (WIFI_ADAPTER.test(name)) s += 2;
  if (VIRTUAL_ADAPTER.test(name)) s -= 4;
  return s;
}

// Link Cloudflare Tunnel đang chạy (scripts/dev-all.mjs ghi vào TUNNEL_URL_FILE, xóa khi tắt). Không có / sai → null.
function tunnelUrl(): string | null {
  try {
    const url = readFileSync(env.TUNNEL_URL_FILE, "utf8").trim();
    return /^https:\/\/[a-z0-9-]+\.trycloudflare\.com\/?$/.test(url) ? new URL("/", url).toString() : null;
  } catch {
    return null;
  }
}

// Danh sách link mở trang chủ Web User, dùng để tạo mã QR cho khách quét.
// Thứ tự ưu tiên: WEB_USER_PUBLIC_URL (đã triển khai) → Cloudflare Tunnel đang chạy (khách dùng 4G vẫn vào) → IP Wi-Fi.
export function joinLinks(): JoinLink[] {
  if (env.WEB_USER_PUBLIC_URL) {
    return [{ url: new URL("/", env.WEB_USER_PUBLIC_URL).toString(), label: "Địa chỉ công khai", recommended: true }];
  }
  const tunnel = tunnelUrl();
  const found: { url: string; label: string; score: number }[] = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== "IPv4" || a.internal || a.address.startsWith("169.254.")) continue;
      found.push({ url: `http://${a.address}:${env.WEB_USER_PORT}/`, label: name, score: score(name, a.address) });
    }
  }
  found.sort((x, y) => y.score - x.score);
  if (tunnel) {
    // Có tunnel: khuyên dùng link công khai, vẫn liệt kê IP Wi-Fi để chọn khi cả lớp dùng chung Wi-Fi
    return [{ url: tunnel, label: "Cloudflare Tunnel (mọi mạng, kể cả 4G)", recommended: true }, ...found.map((f) => ({ url: f.url, label: f.label, recommended: false }))];
  }
  // Chỉ khuyên dùng địa chỉ đứng đầu, và chỉ khi nó không phải card ảo
  return found.map((f, i) => ({ url: f.url, label: f.label, recommended: i === 0 && f.score >= 0 }));
}

export const __test = { score };
