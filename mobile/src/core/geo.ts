// Tọa độ và khoảng cách – dùng chung cho geofence, bản đồ, lộ trình mô phỏng (PRD v1.0, mục 4.3.3).
export interface LatLng {
  lat: number;
  lng: number;
}

const R = 6_371_000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

// Haversine trên mặt cầu bán kính 6 371 000 m – đủ chính xác ở khoảng cách vài trăm mét.
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Dịch một tọa độ đi (northM, eastM) mét – dùng để thêm nhiễu và nội suy lộ trình mô phỏng.
export function offsetM(p: LatLng, northM: number, eastM: number): LatLng {
  return {
    lat: p.lat + toDeg(northM / R),
    lng: p.lng + toDeg(eastM / (R * Math.cos(toRad(p.lat)))),
  };
}

// Hướng đi từ a tới b (độ, 0 = Bắc, theo chiều kim đồng hồ) – cho "Điểm tiếp theo".
export function bearingDeg(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
