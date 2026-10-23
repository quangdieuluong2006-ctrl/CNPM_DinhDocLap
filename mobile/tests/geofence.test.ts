import { describe, expect, it } from "vitest";
import { distanceM, offsetM } from "../src/core/geo";
import { type Fix, GEOFENCE, GeofenceEngine, type GeoPlace } from "../src/core/geofence";
import { buildRoute, seededRandom } from "../src/core/simulation";

// 5 điểm GPS ngoài trời của dữ liệu mẫu (db/seed/places.vi-en.json).
const OUTDOOR: GeoPlace[] = [
  { id: 1, code: "001", lat: 10.77835, lng: 106.6967, radiusM: 30, priority: 0 },
  { id: 2, code: "002", lat: 10.7779, lng: 106.6964, radiusM: 25, priority: 0 },
  { id: 3, code: "003", lat: 10.77755, lng: 106.69605, radiusM: 30, priority: 0 },
  { id: 4, code: "004", lat: 10.77725, lng: 106.69565, radiusM: 25, priority: 0 },
  { id: 5, code: "005", lat: 10.7764, lng: 106.6948, radiusM: 30, priority: 0 },
];

// Chạy một chuỗi mẫu qua engine với đồng hồ "now" = thời điểm của mẫu (không có mẫu cũ).
function run(engine: GeofenceEngine, fixes: Fix[], clock: { t: number }, onTrigger?: (p: GeoPlace) => void) {
  const triggered: string[] = [];
  for (const f of fixes) {
    clock.t = f.timestamp;
    const r = engine.process(f);
    if (r.trigger) {
      triggered.push(r.trigger.code);
      engine.markAutoPlayed(r.trigger.id, f.timestamp);
      onTrigger?.(r.trigger);
    }
  }
  return triggered;
}

const at = (p: { lat: number; lng: number }, t: number, accuracy = 8): Fix => ({ ...p, accuracy, timestamp: t });

describe("Haversine", () => {
  it("khoảng cách khớp với dịch chuyển đã biết (sai số < 0,5 m)", () => {
    const a = OUTDOOR[0]!;
    expect(distanceM(a, offsetM(a, 30, 0))).toBeCloseTo(30, 0);
    expect(distanceM(a, offsetM(a, 0, 40))).toBeCloseTo(40, 0);
    expect(distanceM(a, a)).toBe(0);
  });
});

describe("GeofenceEngine (PRD mục 4.3, FE-05)", () => {
  it("AC1: lộ trình mô phỏng có nhiễu ±3 m → 5 điểm ngoài trời phát đúng thứ tự, mỗi điểm đúng 1 lần", () => {
    for (const seed of [1, 7, 42, 2026, 99999]) {
      const clock = { t: 0 };
      const engine = new GeofenceEngine(OUTDOOR, () => clock.t);
      const start = offsetM(OUTDOOR[0]!, 70, 0);
      const end = offsetM(OUTDOOR[4]!, -70, 0);
      const route = buildRoute([start, ...OUTDOOR, end], { noiseM: 3, random: seededRandom(seed), startAt: 1_000_000 });
      expect(run(engine, route, clock)).toEqual(["001", "002", "003", "004", "005"]);
    }
  });

  it("AC2: đứng ở mép vùng, GPS dao động ra vào → không phát lặp", () => {
    const clock = { t: 0 };
    const place = OUTDOOR[1]!;
    const engine = new GeofenceEngine([place], () => clock.t);
    // Vào hẳn vùng và đứng yên 4 giây → phát 1 lần
    const fixes: Fix[] = [0, 1000, 2000, 3000, 4000].map((t) => at(offsetM(place, 10, 0), t));
    // Sau đó đứng ở mép, GPS dao động 20 m ↔ 32 m (ra khỏi bán kính 25 m nhưng chưa quá 25 + 10 m)
    for (let i = 0; i < 120; i++) fixes.push(at(offsetM(place, i % 2 ? 20 : 32, 0), 5000 + 1000 * i));
    expect(run(engine, fixes, clock)).toEqual(["002"]);
    expect(engine.isInside(place.id)).toBe(true);
  });

  it("GPS dao động ra/vào ngay từ đầu (chưa ổn định) → chưa phát", () => {
    const clock = { t: 0 };
    const place = OUTDOOR[1]!;
    const engine = new GeofenceEngine([place], () => clock.t);
    const fixes = Array.from({ length: 30 }, (_, i) => at(offsetM(place, i % 2 ? 20 : 32, 0), 1000 * i));
    expect(run(engine, fixes, clock)).toEqual([]);
  });

  it("phải ở trong vùng ≥ 3 giây và ≥ 2 mẫu; đi lướt qua 1 mẫu thì không phát", () => {
    const clock = { t: 0 };
    const place = OUTDOOR[1]!;
    const engine = new GeofenceEngine([place], () => clock.t);
    const outside = offsetM(place, 60, 0);
    expect(run(engine, [at(outside, 0), at(place, 1000), at(outside, 2000)], clock)).toEqual([]);
    // Vào lại và đứng yên: mẫu 2 lúc +2 s chưa đủ 3 s, mẫu lúc +3 s mới kích hoạt (AC4: ≤ 3 giây)
    const steps = [at(place, 10_000), at(place, 12_000), at(place, 13_000)];
    clock.t = steps[0]!.timestamp;
    expect(engine.process(steps[0]!).trigger).toBeNull();
    clock.t = steps[1]!.timestamp;
    expect(engine.process(steps[1]!).trigger).toBeNull();
    clock.t = steps[2]!.timestamp;
    expect(engine.process(steps[2]!).trigger?.code).toBe("002");
  });

  it("AC3: hai vùng giao nhau → chọn điểm ưu tiên cao hơn, bằng nhau thì chọn điểm gần hơn", () => {
    const a: GeoPlace = { id: 10, code: "010", lat: 10.7779, lng: 106.6964, radiusM: 40, priority: 0 };
    const b: GeoPlace = { ...a, id: 11, code: "011", ...offsetM(a, 20, 0) };
    const standAt = offsetM(a, 15, 0); // cách a 15 m, cách b 5 m
    const go = (places: GeoPlace[]) => {
      const clock = { t: 0 };
      return run(new GeofenceEngine(places, () => clock.t), [0, 1500, 3000, 4500].map((t) => at(standAt, t)), clock);
    };
    expect(go([a, b])).toEqual(["011"]);
    expect(go([{ ...a, priority: 5 }, b])).toEqual(["010"]);
  });

  it("thời gian chờ 10 phút: ra rồi vào lại sớm → chỉ báo suppressed; sau 10 phút → phát lại", () => {
    const clock = { t: 0 };
    const place = OUTDOOR[1]!;
    const engine = new GeofenceEngine([place], () => clock.t);
    const far = offsetM(place, 80, 0);
    const stay = (t0: number) => [0, 1500, 3000].map((d) => at(place, t0 + d));
    // Đi từ ngoài vào bằng tốc độ đi bộ hợp lệ (không bị lọc "nhảy")
    const walkIn = (t0: number) => buildRoute([far, place], { startAt: t0, noiseM: 0 });
    expect(run(engine, [...walkIn(0), ...stay(100_000)], clock)).toEqual(["002"]);
    const back = walkIn(200_000).reverse().map((f, i) => ({ ...f, timestamp: 200_000 + i * 1000 }));
    run(engine, back, clock);
    const again = walkIn(300_000);
    let suppressed = 0;
    for (const f of [...again, ...stay(400_000)]) {
      clock.t = f.timestamp;
      const r = engine.process(f);
      expect(r.trigger).toBeNull();
      suppressed += r.suppressed.length;
    }
    expect(suppressed).toBe(1);
    const later = 100_000 + GEOFENCE.REPLAY_COOLDOWN_MS + 60_000;
    run(engine, back.map((f, i) => ({ ...f, timestamp: later + i * 1000 })), clock);
    expect(run(engine, [...walkIn(later + 200_000), ...stay(later + 300_000)], clock)).toEqual(["002"]);
  });

  it("GPS bắt lại ở vị trí mới (dịch chuyển thật) → sau 3 mẫu nhất quán thì chấp nhận, không bỏ mãi mãi", () => {
    const clock = { t: 0 };
    const place = OUTDOOR[1]!;
    const engine = new GeofenceEngine([place], () => clock.t);
    const far = offsetM(place, 300, 0);
    clock.t = 0;
    expect(engine.process(at(far, 0)).accepted).toBe(true);
    const results = [1000, 2000, 3000, 4000, 5000, 6000, 7000].map((t) => {
      clock.t = t;
      return engine.process(at(place, t));
    });
    expect(results.slice(0, 2).map((r) => r.reason)).toEqual(["jump", "jump"]);
    expect(results[2]!.accepted).toBe(true);
    expect(results.map((r) => r.trigger?.code).filter(Boolean)).toEqual(["002"]);
    // Một mẫu nhiễu lẻ loi rồi quay về → vẫn bị bỏ, không làm dịch chuyển vị trí
    clock.t = 8000;
    expect(engine.process(at(far, 8000)).reason).toBe("jump");
    clock.t = 9000;
    expect(engine.process(at(place, 9000)).accepted).toBe(true);
  });

  it("lọc tín hiệu: sai số > 35 m, mẫu cũ > 10 s, nhảy > 15 m/s đều bị bỏ", () => {
    const clock = { t: 100_000 };
    const place = OUTDOOR[1]!;
    const engine = new GeofenceEngine([place], () => clock.t);
    expect(engine.process(at(place, 100_000, 50)).reason).toBe("accuracy");
    expect(engine.process(at(place, 80_000)).reason).toBe("stale");
    expect(engine.process(at(place, 100_000)).accepted).toBe(true);
    clock.t = 101_000;
    expect(engine.process(at(offsetM(place, 100, 0), 101_000)).reason).toBe("jump");
    expect(engine.isWeakSignal()).toBe(false);
    clock.t = 115_000;
    expect(engine.isWeakSignal()).toBe(true);
  });
});
