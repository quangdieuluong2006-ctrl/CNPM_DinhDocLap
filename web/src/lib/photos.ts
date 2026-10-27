import { mediaUrl } from "./api";
import type { Place } from "./types";

// Ảnh có sẵn trong web/public/images/places (nguồn ghi ở CREDITS.md cùng thư mục; Web Admin dùng chung).
// Dùng khi điểm chưa có ảnh do quản trị viên tải lên; ảnh tải lên ở Web Admin luôn được ưu tiên.
export interface Photo {
  src: string;
  credit: string | null; // null = ảnh sưu tầm chưa rõ tác giả (giao diện ghi "Sưu tầm" theo ngôn ngữ đang chọn)
}

const DIR = "/images/places/";

export const HERO_PHOTO: Photo = { src: `${DIR}004-mat-tien.webp`, credit: null };

export const PLACE_PHOTOS: Record<string, Photo> = {
  "001": { src: `${DIR}001-cong-chinh.webp`, credit: "Vietnam+ (TTXVN)" },
  "002": { src: `${DIR}002-xe-tang-390.webp`, credit: "Báo Cà Mau" },
  "003": { src: `${DIR}003-dai-phun-nuoc.webp`, credit: null },
  "004": HERO_PHOTO,
  "005": { src: `${DIR}005-may-bay-f5.webp`, credit: null },
  "101": { src: `${DIR}101-hoi-truong-thong-nhat.webp`, credit: null },
  "102": { src: `${DIR}102-phong-hop-noi-cac.webp`, credit: null },
  "103": { src: `${DIR}103-phong-khanh-tiet.webp`, credit: null },
  "201": { src: `${DIR}201-phong-trinh-quoc-thu.webp`, credit: null },
  "202": { src: `${DIR}202-phong-lam-viec-tong-thong.webp`, credit: null },
  "401": { src: `${DIR}401-san-thuong-truc-thang.webp`, credit: null },
  "901": { src: `${DIR}901-ham-chi-huy.webp`, credit: null },
};

export function placePhoto(place: Pick<Place, "code" | "imageUrl">): Photo | null {
  const uploaded = mediaUrl(place.imageUrl);
  if (uploaded) return { src: uploaded, credit: "" }; // ảnh của Dinh do quản trị viên tải lên – không cần ghi nguồn
  return PLACE_PHOTOS[place.code] ?? null;
}
