import { mediaUrl } from "./api";

// Ảnh có sẵn của các điểm: dùng chung thư mục ảnh của Web User (web/public/images/places, nguồn ghi ở CREDITS.md),
// không chép thêm bản thứ hai. Tên tệp bắt đầu bằng số điểm: "101-hoi-truong-thong-nhat.webp" → điểm 101.
// Vite đóng gói các tệp này vào bản build của Web Admin (khi dev cần server.fs.allow – xem vite.config.ts).
const files = import.meta.glob("../../../web/public/images/places/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export const BUNDLED_PHOTOS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [
    path.split("/").pop()!.slice(0, 3),
    url,
  ]),
);

export interface PlaceImage {
  src: string;
  bundled: boolean; // true = ảnh có sẵn (quản trị viên chưa tải ảnh lên)
}

// Ảnh quản trị viên tải lên luôn được ưu tiên; chưa có thì dùng ảnh có sẵn theo số điểm; không có cả hai → null.
export function placeImage(place: {
  code: string;
  imageUrl: string | null;
}): PlaceImage | null {
  const uploaded = mediaUrl(place.imageUrl);
  if (uploaded) return { src: uploaded, bundled: false };
  const bundled = BUNDLED_PHOTOS[place.code];
  return bundled ? { src: bundled, bundled: true } : null;
}
