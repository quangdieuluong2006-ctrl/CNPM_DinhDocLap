import type { LatLng } from "../core/geo";
import type { Fix } from "../core/geofence";
import type { Place } from "../services/api";

export interface PlaceMapProps {
  places: Place[];
  fix: Fix | null;
  playingId: number | null;
  completed: number[];
  selectedId: number | null;
  onSelect(place: Place): void;
  onMapPress?(p: LatLng): void; // chế độ mô phỏng: chạm để dịch chuyển
  recenterKey?: number; // đổi giá trị → căn lại về vị trí hiện tại
  onSelectBuilding?(): void; // bấm marker gộp các điểm trong nhà
}

// Các điểm trong nhà nằm sát nhau trong tòa nhà chính (GPS không phân biệt được phòng/tầng) nên gộp thành
// một marker ở tâm, ghi số điểm; khách mở danh sách để chọn phòng hoặc quét mã QR tại phòng.
export function indoorCluster(places: Place[]): { lat: number; lng: number; count: number } | null {
  const indoor = places.filter((p) => p.trigger === "indoor");
  if (indoor.length === 0) return null;
  return {
    lat: indoor.reduce((s, p) => s + p.lat, 0) / indoor.length,
    lng: indoor.reduce((s, p) => s + p.lng, 0) / indoor.length,
    count: indoor.length,
  };
}
