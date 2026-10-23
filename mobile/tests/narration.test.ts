import { describe, expect, it } from "vitest";
import { NarrationController, type NarrationItem, type PlaybackEngine, type PlaybackHandlers, type VisitRecord } from "../src/core/narration";

// Engine giả: ghi lại thao tác, cho test chủ động báo tiến độ / kết thúc.
class FakeEngine implements PlaybackEngine {
  kind = "audio" as const;
  handlers!: PlaybackHandlers;
  log: string[] = [];
  constructor(public item: NarrationItem) {}
  start(_item: NarrationItem, _rate: number, h: PlaybackHandlers) { this.handlers = h; this.log.push("start"); }
  pause() { this.log.push("pause"); }
  resume() { this.log.push("resume"); }
  stop() { this.log.push("stop"); }
}

const item = (placeId: number): NarrationItem => ({
  placeId, code: String(placeId).padStart(3, "0"), title: `Điểm ${placeId}`, lang: "vi", ttsLocale: "vi-VN", text: "…", audioUri: null,
});

function setup(opts: { inside?: (id: number) => boolean } = {}) {
  const engines: FakeEngine[] = [];
  const visits: VisitRecord[] = [];
  const started: string[] = [];
  const c = new NarrationController({
    createEngine: (i) => { const e = new FakeEngine(i); engines.push(e); return e; },
    onVisit: (v) => visits.push(v),
    onStart: (i, t) => started.push(`${i.code}:${t}`),
    isStillInside: opts.inside,
    now: () => Date.parse("2026-10-28T03:00:00Z"),
  });
  const active = () => engines[engines.length - 1]!;
  return { c, engines, visits, started, active };
}

describe("NarrationController (PRD mục 4.5, FE-07)", () => {
  it("GPS khi đang rảnh → phát ngay; bài kết thúc → ghi lượt ghé completed", () => {
    const { c, visits, active } = setup();
    expect(c.request(item(1), "gps")).toBe("started");
    expect(c.getState()).toMatchObject({ status: "playing", current: { placeId: 1, trigger: "gps" } });
    active().handlers.onProgress(50, 100);
    active().handlers.onEnd();
    expect(c.getState().status).toBe("idle");
    expect(visits).toEqual([expect.objectContaining({ placeId: 1, trigger: "gps", listenedSec: 100, completed: true })]);
  });

  it("GPS khi đang phát bài khác → KHÔNG cắt ngang: thẻ gợi ý + hàng đợi, tự phát sau khi bài hiện tại hết", () => {
    const { c, engines, active } = setup();
    c.request(item(1), "gps");
    expect(c.request(item(2), "gps")).toBe("queued");
    expect(engines[0]!.log).toEqual(["start"]); // bài 1 không bị dừng
    expect(c.getState().suggestion?.placeId).toBe(2);
    active().handlers.onEnd();
    expect(c.getState().current?.placeId).toBe(2);
    expect(c.getState().suggestion).toBeNull();
  });

  it("hàng đợi chỉ phát điểm khách vẫn còn ở trong vùng", () => {
    const { c, active } = setup({ inside: (id) => id !== 2 });
    c.request(item(1), "gps");
    c.request(item(2), "gps");
    active().handlers.onEnd();
    expect(c.getState()).toMatchObject({ status: "idle", current: null, queue: [] });
  });

  it("QR / số điểm / bấm tay → dừng bài hiện tại và phát ngay; bài bị dừng ghi lượt ghé chưa hoàn thành", () => {
    const { c, engines, visits, active } = setup();
    c.request(item(1), "gps");
    active().handlers.onProgress(30, 100);
    expect(c.request(item(201), "qr")).toBe("started");
    expect(engines[0]!.log).toEqual(["start", "stop"]);
    expect(c.getState().current).toMatchObject({ placeId: 201, trigger: "qr" });
    expect(visits[0]).toMatchObject({ placeId: 1, listenedSec: 30, completed: false });
  });

  it("AC3: không bao giờ có hai bài phát cùng lúc", () => {
    const { c, engines } = setup();
    c.request(item(1), "manual");
    c.request(item(2), "code");
    c.request(item(3), "manual");
    const running = engines.filter((e) => e.log[e.log.length - 1] === "start");
    expect(running).toHaveLength(1);
  });

  it("đã nghe hết trong ngày, hoặc tắt tự động phát → GPS chỉ gợi ý", () => {
    const { c, active } = setup();
    c.request(item(1), "gps");
    active().handlers.onProgress(95, 100);
    c.stop(); // ≥ 90% → tính là đã nghe hết
    expect(c.request(item(1), "gps")).toBe("suggested");
    c.dismissSuggestion();
    c.autoPlay = false;
    expect(c.request(item(5), "gps")).toBe("suggested");
    expect(c.getState().status).toBe("idle");
    c.acceptSuggestion();
    expect(c.getState().current?.placeId).toBe(5);
  });

  it("tạm dừng / tiếp tục / phát lại từ đầu bằng ngôn ngữ khác", () => {
    const { c, engines, started } = setup();
    c.request(item(1), "manual");
    c.toggle();
    expect(c.getState().status).toBe("paused");
    c.toggle();
    expect(engines[0]!.log).toEqual(["start", "pause", "resume"]);
    c.restart({ ...item(1), lang: "ja", ttsLocale: "ja-JP" });
    expect(c.getState().current).toMatchObject({ placeId: 1, lang: "ja", trigger: "manual" });
    expect(started).toEqual(["001:manual", "001:manual"]);
  });

  it("lỗi phát → về trạng thái rảnh kèm thông báo lỗi", () => {
    const { c, active } = setup();
    c.request(item(1), "manual");
    active().handlers.onError("Không tải được tệp âm thanh");
    expect(c.getState()).toMatchObject({ status: "idle", current: null, error: "Không tải được tệp âm thanh", failed: { placeId: 1 } });
  });
});
