import { distanceM, type LatLng } from "./geo";

// Hằng số cấu hình (PRD v1.0, mục 4.3, Phụ lục C).
export const GEOFENCE = {
  MAX_ACCURACY_M: 35, // bỏ mẫu có sai số lớn hơn
  MAX_AGE_MS: 10_000, // bỏ mẫu cũ hơn
  MAX_SPEED_MPS: 15, // bỏ mẫu "nhảy" phi thực tế đối với khách đi bộ
  DWELL_MS: 3_000, // phải ở trong vùng ít nhất 3 giây…
  MIN_SAMPLES: 2, // …và 2 mẫu hợp lệ liên tiếp mới tính là đã vào
  EXIT_HYSTERESIS_M: 10, // ra khỏi bán kính + 10 m mới tính là đã rời vùng
  REPLAY_COOLDOWN_MS: 10 * 60_000, // không tự phát lại cùng điểm trong 10 phút
  WEAK_SIGNAL_MS: 10_000, // 10 giây không có mẫu hợp lệ → "GPS yếu"
  JUMP_CONFIRM_SAMPLES: 3, // 3 mẫu "nhảy" liên tiếp gần nhau = vị trí mới thật (GPS bắt lại sau khi mất tín hiệu)
} as const;

export interface Fix extends LatLng {
  accuracy: number; // mét
  timestamp: number; // ms
}

export interface GeoPlace extends LatLng {
  id: number;
  code: string;
  radiusM: number;
  priority: number;
}

type ZoneState = { kind: "outside" } | { kind: "entering"; since: number; samples: number } | { kind: "inside" };

export type RejectReason = "accuracy" | "stale" | "jump";

export interface GeofenceResult {
  accepted: boolean;
  reason?: RejectReason;
  // Điểm vừa chuyển sang INSIDE và được chọn để tự phát (ưu tiên cao nhất, rồi gần nhất), ngoài thời gian chờ.
  trigger: GeoPlace | null;
  // Điểm vừa vào nhưng đang trong thời gian chờ (đã tự phát < 10 phút trước) – chỉ gợi ý, không tự phát.
  suppressed: GeoPlace[];
  exited: GeoPlace[];
  inside: GeoPlace[];
}

// Máy trạng thái vùng kích hoạt cho mọi điểm GPS (PRD v1.0, mục 4.3.4–4.3.5).
// Thuần TypeScript, không phụ thuộc React Native → kiểm thử được bằng lộ trình mô phỏng.
export class GeofenceEngine {
  private states = new Map<number, ZoneState>();
  private lastAutoPlayed = new Map<number, number>();
  private lastAccepted: Fix | null = null;
  private jumpRun: Fix[] = [];

  constructor(
    private places: GeoPlace[],
    private readonly now: () => number = () => Date.now(),
  ) {}

  setPlaces(places: GeoPlace[]): void {
    this.places = places;
    const ids = new Set(places.map((p) => p.id));
    for (const id of this.states.keys()) if (!ids.has(id)) this.states.delete(id);
  }

  // Đánh dấu đã tự phát (bắt đầu thời gian chờ). Gọi khi bộ điều phối thật sự phát điểm do GPS.
  markAutoPlayed(placeId: number, at = this.now()): void {
    this.lastAutoPlayed.set(placeId, at);
  }

  isWeakSignal(): boolean {
    return !this.lastAccepted || this.now() - this.lastAccepted.timestamp > GEOFENCE.WEAK_SIGNAL_MS;
  }

  isInside(placeId: number): boolean {
    return this.states.get(placeId)?.kind === "inside";
  }

  reset(): void {
    this.states.clear();
    this.lastAccepted = null;
  }

  process(fix: Fix): GeofenceResult {
    const empty = { trigger: null, suppressed: [], exited: [], inside: this.insidePlaces() };
    const reason = this.filter(fix);
    if (reason) return { accepted: false, reason, ...empty };
    this.lastAccepted = fix;

    const entered: { place: GeoPlace; d: number }[] = [];
    const exited: GeoPlace[] = [];
    for (const place of this.places) {
      const d = distanceM(fix, place);
      const state = this.states.get(place.id) ?? { kind: "outside" };
      if (state.kind === "outside") {
        if (d <= place.radiusM) this.states.set(place.id, { kind: "entering", since: fix.timestamp, samples: 1 });
      } else if (state.kind === "entering") {
        if (d > place.radiusM) this.states.set(place.id, { kind: "outside" });
        else {
          const samples = state.samples + 1;
          if (samples >= GEOFENCE.MIN_SAMPLES && fix.timestamp - state.since >= GEOFENCE.DWELL_MS) {
            this.states.set(place.id, { kind: "inside" });
            entered.push({ place, d });
          } else this.states.set(place.id, { ...state, samples });
        }
      } else if (d > place.radiusM + GEOFENCE.EXIT_HYSTERESIS_M) {
        this.states.set(place.id, { kind: "outside" });
        exited.push(place);
      }
    }

    const coolingDown = (p: GeoPlace) => {
      const at = this.lastAutoPlayed.get(p.id);
      return at !== undefined && fix.timestamp - at < GEOFENCE.REPLAY_COOLDOWN_MS;
    };
    const candidates = entered.filter((e) => !coolingDown(e.place));
    candidates.sort((a, b) => b.place.priority - a.place.priority || a.d - b.d);
    return {
      accepted: true,
      trigger: candidates[0]?.place ?? null,
      suppressed: entered.filter((e) => coolingDown(e.place)).map((e) => e.place),
      exited,
      inside: this.insidePlaces(),
    };
  }

  private filter(fix: Fix): RejectReason | undefined {
    if (fix.accuracy > GEOFENCE.MAX_ACCURACY_M) return "accuracy";
    if (this.now() - fix.timestamp > GEOFENCE.MAX_AGE_MS) return "stale";
    const prev = this.lastAccepted;
    if (prev) {
      const dt = (fix.timestamp - prev.timestamp) / 1000;
      if (dt <= 0) return "stale";
      if (distanceM(prev, fix) / dt > GEOFENCE.MAX_SPEED_MPS) {
        // Nếu chỉ so với mẫu hợp lệ cuối, sau một lần dịch chuyển thật mọi mẫu sau đều bị coi là "nhảy" mãi mãi.
        // Vì vậy: các mẫu "nhảy" liên tiếp nhất quán với nhau (tốc độ hợp lý giữa chúng) đủ 3 mẫu → chấp nhận vị trí mới.
        const last = this.jumpRun[this.jumpRun.length - 1];
        const consistent = last && fix.timestamp > last.timestamp
          && distanceM(last, fix) / ((fix.timestamp - last.timestamp) / 1000) <= GEOFENCE.MAX_SPEED_MPS;
        this.jumpRun = consistent ? [...this.jumpRun, fix] : [fix];
        if (this.jumpRun.length < GEOFENCE.JUMP_CONFIRM_SAMPLES) return "jump";
      }
    }
    this.jumpRun = [];
    return undefined;
  }

  private insidePlaces(): GeoPlace[] {
    return this.places.filter((p) => this.isInside(p.id));
  }
}
