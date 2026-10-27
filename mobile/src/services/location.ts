import * as Location from "expo-location";
import type { Fix } from "../core/geofence";
import type { LatLng } from "../core/geo";
import { buildRoute, SIM_ACCURACY_M } from "../core/simulation";

// Nguồn vị trí thay thế được (PRD v1.0, mục 4.8): logic geofence phía trên không biết vị trí thật hay mô phỏng.
export interface LocationProvider {
  readonly kind: "real" | "simulated";
  start(onFix: (fix: Fix) => void, onError?: (message: string) => void): Promise<void>;
  stop(): void;
}

export class RealLocationProvider implements LocationProvider {
  readonly kind = "real" as const;
  private sub: Location.LocationSubscription | null = null;

  async start(onFix: (fix: Fix) => void, onError?: (message: string) => void): Promise<void> {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      onError?.("PERMISSION_DENIED");
      return;
    }
    this.sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 3 },
      (loc) =>
        onFix({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? 999,
          timestamp: loc.timestamp,
        }),
      (reason) => onError?.(String(reason)),
    );
  }

  stop(): void {
    this.sub?.remove();
    this.sub = null;
  }
}

// Mô phỏng: chạm trên bản đồ để "dịch chuyển", hoặc chạy theo lộ trình mẫu với tốc độ đi bộ (có thể tăng tốc).
// Dấu thời gian của mẫu là thời gian thật để bộ lọc "mẫu cũ" và "dwell 3 giây" hoạt động như với GPS thật.
export class SimulatedLocationProvider implements LocationProvider {
  readonly kind = "simulated" as const;
  private onFix: ((fix: Fix) => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private hold: ReturnType<typeof setInterval> | null = null;
  private current: LatLng;

  constructor(start: LatLng) {
    this.current = start;
  }

  async start(onFix: (fix: Fix) => void): Promise<void> {
    this.onFix = onFix;
    this.emit(this.current);
    // Đứng yên vẫn gửi mẫu mỗi giây (giống GPS thật) để đủ điều kiện dwell.
    this.hold = setInterval(() => {
      if (!this.timer) this.emit(this.current);
    }, 1000);
  }

  stop(): void {
    this.stopRoute();
    if (this.hold) clearInterval(this.hold);
    this.hold = null;
    this.onFix = null;
  }

  // Chạm trên bản đồ: nhảy tới điểm chạm. Dấu thời gian lùi đủ xa để không bị lọc "nhảy > 15 m/s".
  teleport(p: LatLng): void {
    this.stopRoute();
    this.current = p;
    this.emit(p);
  }

  playRoute(waypoints: LatLng[], speedup = 1, onDone?: () => void): void {
    this.stopRoute();
    const route = buildRoute([this.current, ...waypoints], { stepMs: 1000, noiseM: 3 });
    let i = 0;
    this.timer = setInterval(() => {
      const f = route[i++];
      if (!f) {
        this.stopRoute();
        onDone?.();
        return;
      }
      this.current = { lat: f.lat, lng: f.lng };
      this.emit(this.current);
    }, 1000 / speedup);
  }

  stopRoute(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  get isPlayingRoute(): boolean {
    return this.timer !== null;
  }

  private emit(p: LatLng): void {
    this.onFix?.({ ...p, accuracy: SIM_ACCURACY_M, timestamp: Date.now() });
  }
}
