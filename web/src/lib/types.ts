// Kiểu dữ liệu trả về từ API công khai (xem Swagger /api/docs).
export type Zone = "outdoor" | "ground" | "floor1" | "floor2" | "rooftop" | "basement";

export interface Language {
  code: string;
  nameVi: string;
  nameEn: string;
  nameNative: string;
  ttsLocale: string;
  completeness: number;
  approved: number;
  pending: number;
}

export interface PlaceContent {
  lang: string;
  isFallback: boolean;
  title: string;
  summary: string;
  body?: string;
  status: "approved" | "pending";
  audioUrl: string | null;
  audioDurationSec: number | null;
  audioBytes: number | null;
}

export interface Place {
  id: number;
  code: string;
  slug: string;
  trigger: "gps" | "indoor";
  zone: Zone;
  lat: number;
  lng: number;
  radiusM: number;
  priority: number;
  sortOrder: number;
  imageUrl: string | null;
  content: PlaceContent | null;
}

export interface PlaceDetail extends Place {
  languages: string[];
}

export type Trigger = "gps" | "qr" | "code" | "manual" | "simulated";
