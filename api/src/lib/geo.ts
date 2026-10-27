// Khoảng cách Haversine (mét) giữa hai tọa độ – cùng công thức với bộ geofence trên Mobile (PRD v1.0, mục 4.3).
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Hai vùng tròn giao nhau sâu hơn 50% bán kính nhỏ hơn → cảnh báo khi lưu (PRD v1.0, mục 4.2).
export function overlapWarnings(
  place: { lat: number; lng: number; radiusM: number },
  others: { code: string; lat: number; lng: number; radius_m: number }[],
): { code: string; distanceM: number; overlapM: number }[] {
  return others.flatMap((o) => {
    const d = distanceM(place, { lat: Number(o.lat), lng: Number(o.lng) });
    const overlap = place.radiusM + o.radius_m - d;
    return overlap > 0.5 * Math.min(place.radiusM, o.radius_m)
      ? [{ code: o.code, distanceM: Math.round(d), overlapM: Math.round(overlap) }]
      : [];
  });
}
