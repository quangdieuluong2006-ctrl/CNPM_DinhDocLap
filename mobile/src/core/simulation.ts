import { distanceM, offsetM, type LatLng } from "./geo";
import type { Fix } from "./geofence";

export const WALK_SPEED_MPS = 1.2;
export const SIM_ACCURACY_M = 8;

// Lộ trình mẫu: đi lần lượt qua các điểm (theo sortOrder) với tốc độ đi bộ, mỗi `stepMs` một mẫu,
// thêm nhiễu ±noiseM mét để thử cơ chế chống dao động (PRD v1.0, mục 4.8).
export function buildRoute(
  waypoints: LatLng[],
  opts: { stepMs?: number; speedMps?: number; noiseM?: number; random?: () => number; startAt?: number } = {},
): Fix[] {
  const step = opts.stepMs ?? 1000;
  const speed = opts.speedMps ?? WALK_SPEED_MPS;
  const noise = opts.noiseM ?? 3;
  const random = opts.random ?? Math.random;
  const fixes: Fix[] = [];
  let t = opts.startAt ?? 0;
  const jitter = () => (random() * 2 - 1) * noise;
  for (let i = 0; i + 1 < waypoints.length; i++) {
    const a = waypoints[i]!;
    const b = waypoints[i + 1]!;
    const n = Math.max(1, Math.ceil(distanceM(a, b) / (speed * (step / 1000))));
    for (let k = 0; k < n; k++) {
      const f = k / n;
      const p = { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
      fixes.push({ ...offsetM(p, jitter(), jitter()), accuracy: SIM_ACCURACY_M, timestamp: t });
      t += step;
    }
  }
  const last = waypoints[waypoints.length - 1];
  if (last) fixes.push({ ...last, accuracy: SIM_ACCURACY_M, timestamp: t });
  return fixes;
}

// Bộ sinh số giả ngẫu nhiên cố định cho test (cùng hạt giống → cùng lộ trình).
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
