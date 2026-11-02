// Dòng hướng dẫn dưới mã QR "Mời tham gia" (FE-23): đổi theo loại địa chỉ mà quản trị viên đang chiếu.
//  - https:// (địa chỉ công khai hoặc Cloudflare Tunnel): điện thoại dùng 4G hay Wi-Fi nào cũng vào được.
//  - http://<IP> (mạng nội bộ): điện thoại phải dùng cùng Wi-Fi với máy chủ.
export type InviteKind = "internet" | "lan";

export function inviteKind(url: string): InviteKind {
  return new URL(url).protocol === "https:" ? "internet" : "lan";
}

export function inviteHint(url: string): string {
  return inviteKind(url) === "internet"
    ? "Quét bằng camera điện thoại – dùng 4G hay Wi-Fi đều được. Không mở được: kiểm tra lệnh npm run demo (Cloudflare Tunnel) vẫn đang chạy."
    : "Điện thoại phải dùng cùng mạng Wi-Fi với máy này. Không mở được: kiểm tra Web User đang chạy và Windows Firewall cho phép cổng 5173.";
}
