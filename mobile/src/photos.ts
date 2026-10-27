import type { ComponentProps } from "react";
import type { ImageSourcePropType } from "react-native";
import type { Ionicons } from "@expo/vector-icons";

// Ảnh có sẵn trong assets/places (nguồn ghi ở assets/places/CREDITS.md). Ảnh quản trị viên tải lên luôn được ưu tiên.
export interface Photo {
  source: ImageSourcePropType;
  credit: string | null; // null = ảnh sưu tầm chưa rõ tác giả (hiện "Sưu tầm" theo ngôn ngữ đang chọn); "" = không ghi nguồn
}

export const HERO_PHOTO: Photo = { source: require("../assets/places/004-mat-tien.jpg"), credit: null };

export const PLACE_PHOTOS: Record<string, Photo> = {
  "001": { source: require("../assets/places/001-cong-chinh.jpg"), credit: "Vietnam+ (TTXVN)" },
  "002": { source: require("../assets/places/002-xe-tang-390.jpg"), credit: "Báo Cà Mau" },
  "003": { source: require("../assets/places/003-dai-phun-nuoc.jpg"), credit: null },
  "004": HERO_PHOTO,
  "005": { source: require("../assets/places/005-may-bay-f5.jpg"), credit: null },
  "101": { source: require("../assets/places/101-hoi-truong-thong-nhat.jpg"), credit: null },
  "102": { source: require("../assets/places/102-phong-hop-noi-cac.jpg"), credit: null },
  "103": { source: require("../assets/places/103-phong-khanh-tiet.jpg"), credit: null },
  "201": { source: require("../assets/places/201-phong-trinh-quoc-thu.jpg"), credit: null },
  "202": { source: require("../assets/places/202-phong-lam-viec-tong-thong.jpg"), credit: null },
  "401": { source: require("../assets/places/401-san-thuong-truc-thang.jpg"), credit: null },
  "901": { source: require("../assets/places/901-ham-chi-huy.jpg"), credit: null },
};

export function placePhoto(place: { code: string; imageUrl: string | null }, mediaUrl: (p: string | null) => string | null): Photo | null {
  const uploaded = mediaUrl(place.imageUrl);
  if (uploaded) return { source: { uri: uploaded }, credit: "" };
  return PLACE_PHOTOS[place.code] ?? null;
}

// Màu và biểu tượng riêng từng khu vực – ảnh thay thế khi điểm chưa có ảnh (giống Web User)
type IconName = ComponentProps<typeof Ionicons>["name"];
const ZONE_STYLE: Record<string, { icon: IconName; bg: string }> = {
  outdoor: { icon: "leaf", bg: "#1F7A5A" },
  ground: { icon: "enter", bg: "#B8862F" },
  floor1: { icon: "business", bg: "#0369A1" },
  floor2: { icon: "layers", bg: "#4F46E5" },
  rooftop: { icon: "sunny", bg: "#EA580C" },
  basement: { icon: "shield-half", bg: "#57534E" },
};

export function zoneStyle(zone: string) {
  return ZONE_STYLE[zone] ?? ZONE_STYLE.outdoor!;
}
