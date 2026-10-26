import { mediaUrl } from "./api";
import type { Place } from "./types";

// Ảnh có sẵn trong web/public/images/places (nguồn ghi ở CREDITS.md cùng thư mục).
// Dùng khi điểm chưa có ảnh do quản trị viên tải lên; ảnh tải lên ở Web Admin luôn được ưu tiên.
export interface Photo {
  src: string;
  credit: string;
}

const DIR = "/images/places/";

export const HERO_PHOTO: Photo = { src: `${DIR}004-mat-tien.webp`, credit: "Sưu tầm" };

export const PLACE_PHOTOS: Record<string, Photo> = {
  "001": { src: `${DIR}001-cong-chinh.webp`, credit: "Vietnam+ (TTXVN)" },
  "002": { src: `${DIR}002-xe-tang-390.webp`, credit: "Báo Cà Mau" },
  "003": { src: `${DIR}003-dai-phun-nuoc.webp`, credit: "Sưu tầm" },
  "004": HERO_PHOTO,
  "005": { src: `${DIR}005-may-bay-f5.webp`, credit: "Sưu tầm" },
};

export function placePhoto(place: Pick<Place, "code" | "imageUrl">): Photo | null {
  const uploaded = mediaUrl(place.imageUrl);
  if (uploaded) return { src: uploaded, credit: "" };
  return PLACE_PHOTOS[place.code] ?? null;
}
