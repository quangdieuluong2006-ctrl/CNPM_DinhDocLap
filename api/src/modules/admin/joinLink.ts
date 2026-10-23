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

// Danh sách link mở trang Đăng ký của Web User, dùng để tạo mã QR cho người tham gia quét.
export function joinLinks(): JoinLink[] {
  if (env.WEB_USER_PUBLIC_URL) {
    return [{ url: new URL("/register", env.WEB_USER_PUBLIC_URL).toString(), label: "Địa chỉ công khai", recommended: true }];
  }
  const found: { url: string; label: string; score: number }[] = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== "IPv4" || a.internal || a.address.startsWith("169.254.")) continue;
      found.push({ url: `http://${a.address}:${env.WEB_USER_PORT}/register`, label: name, score: score(name, a.address) });
    }
  }
  found.sort((x, y) => y.score - x.score);
  // Chỉ khuyên dùng địa chỉ đứng đầu, và chỉ khi nó không phải card ảo
  return found.map((f, i) => ({ url: f.url, label: f.label, recommended: i === 0 && f.score >= 0 }));
}

export const __test = { score };
