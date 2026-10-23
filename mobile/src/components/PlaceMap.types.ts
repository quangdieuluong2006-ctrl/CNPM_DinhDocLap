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
}
