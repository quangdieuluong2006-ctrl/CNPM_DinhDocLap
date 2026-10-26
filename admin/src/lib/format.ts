// Định dạng thời gian theo giờ Việt Nam cho giao diện quản trị.

export function timeAgo(iso: string, now: number = Date.now()): string {
  const sec = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (sec < 5) return "vừa xong";
  if (sec < 60) return `${sec} giây trước`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} phút trước`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

const timeFmt = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });

export function clockTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

// "2026-10-22" → "22/10" (ngày đã là ngày Việt Nam do API tính sẵn)
// Tách chuỗi trực tiếp: Intl của vi-VN cho "22-10" hay "22/10" tùy trình duyệt.
export function shortDay(day: string): string {
  const [, month, date] = day.split("-");
  return `${date}/${month}`;
}

export const CLIENT_LABEL: Record<string, string> = { web: "Web", mobile: "Mobile", admin: "Web Admin" };

const dateTimeFmt = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh",
});

export function dateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}

export function bytes(n: number | null | undefined): string {
  if (!n) return "–";
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export function duration(sec: number | null | undefined): string {
  if (!sec) return "–";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export const ROLE_LABEL: Record<string, string> = { user: "Khách tham quan", guide: "Hướng dẫn viên", admin: "Quản trị viên" };
export const ZONE_LABEL: Record<string, string> = {
  outdoor: "Ngoài trời", ground: "Tầng trệt", floor1: "Lầu 1", floor2: "Lầu 2–3", rooftop: "Sân thượng", basement: "Tầng hầm",
};
export const PLACE_STATUS_LABEL: Record<string, string> = { draft: "Nháp", published: "Đang xuất bản", hidden: "Đã ẩn" };
export const CONTENT_STATUS_LABEL: Record<string, string> = { draft: "Nháp", pending: "Chờ duyệt", approved: "Đã duyệt" };
export const TRIGGER_LABEL: Record<string, string> = { gps: "Tự động (GPS)", indoor: "Trong nhà (QR/số)" };

// Tên hành động trong nhật ký (PRD v1.0, mục 13.2) → tiếng Việt
export const ACTION_LABEL: Record<string, string> = {
  "auth.register": "Đăng ký",
  "auth.guest": "Bắt đầu dùng (khách ẩn danh)",
  "auth.login": "Đăng nhập",
  "auth.login_failed": "Đăng nhập thất bại",
  "auth.logout": "Đăng xuất",
  "auth.refresh_reuse": "Phát hiện dùng lại token",
  "place.create": "Thêm điểm",
  "place.update": "Sửa điểm",
  "place.delete": "Xóa điểm",
  "place.content.update": "Sửa bài thuyết minh",
  "place.audio.upload": "Tệp âm thanh",
  "content.publish": "Xuất bản nội dung",
  "language.update": "Cập nhật ngôn ngữ",
  "tour.create": "Tạo nhóm",
  "tour.end": "Kết thúc nhóm",
  "admin.user.lock": "Khóa tài khoản",
  "admin.user.unlock": "Mở khóa tài khoản",
  "admin.user.role_change": "Đổi vai trò",
};
