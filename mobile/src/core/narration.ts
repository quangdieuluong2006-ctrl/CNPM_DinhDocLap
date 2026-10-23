// Bộ điều phối phát duy nhất (NarrationController – PRD v1.0, mục 4.5): mọi yêu cầu phát (bấm tay, QR, số điểm, GPS)
// đi qua đây để không bao giờ có hai bài phát cùng lúc. Thuần TypeScript; phần phát thật (expo-audio/expo-speech)
// được truyền vào qua giao diện PlaybackEngine nên kiểm thử được bằng engine giả.

export type Trigger = "gps" | "qr" | "code" | "manual" | "simulated";

export interface NarrationItem {
  placeId: number;
  code: string;
  title: string;
  lang: string; // ngôn ngữ của bài (có thể là ngôn ngữ dự phòng)
  ttsLocale: string;
  text: string; // tóm tắt + nội dung, dùng cho giọng tổng hợp và hiển thị
  audioUri: string | null; // tệp đã tải về máy hoặc URL trên máy chủ
}

export interface PlaybackHandlers {
  onProgress(positionSec: number, durationSec: number): void;
  onEnd(): void;
  onError(message: string): void;
}

export interface PlaybackEngine {
  readonly kind: "audio" | "tts";
  start(item: NarrationItem, rate: number, handlers: PlaybackHandlers): void;
  pause(): void;
  resume(): void;
  stop(): void;
  seekBy?(deltaSec: number): void;
  setRate?(rate: number): void;
}

export interface VisitRecord {
  placeId: number;
  lang: string;
  trigger: Trigger;
  listenedSec: number;
  completed: boolean;
  startedAt: string;
}

export type NarrationStatus = "idle" | "playing" | "paused";

export interface NarrationState {
  status: NarrationStatus;
  current: (NarrationItem & { trigger: Trigger; engine: "audio" | "tts" }) | null;
  positionSec: number;
  durationSec: number;
  rate: number;
  suggestion: NarrationItem | null; // thẻ "Bạn đang ở gần … – Nghe ngay"
  queue: NarrationItem[]; // điểm GPS chờ phát sau bài hiện tại
  error: string | null;
  failed: NarrationItem | null; // bài không phát được: vẫn hiện văn bản cho khách đọc (mục 4.5.1)
}

export interface NarrationDeps {
  createEngine(item: NarrationItem): PlaybackEngine; // tệp âm thanh hoặc giọng tổng hợp
  onVisit(visit: VisitRecord): void; // ghi lượt ghé khi bài kết thúc hoặc bị dừng
  onStart?(item: NarrationItem, trigger: Trigger): void; // ví dụ: gửi tour.position, đánh dấu cooldown
  isStillInside?(placeId: number): boolean; // điểm trong hàng đợi chỉ phát nếu khách vẫn ở trong vùng
  now?: () => number;
}

export const COMPLETED_RATIO = 0.9; // nghe ≥ 90% thời lượng = đã nghe hết
export const RATES = [0.75, 1, 1.25, 1.5] as const;

type Listener = (s: NarrationState) => void;

export class NarrationController {
  private state: NarrationState = {
    status: "idle", current: null, positionSec: 0, durationSec: 0, rate: 1, suggestion: null, queue: [], error: null, failed: null,
  };
  private engine: PlaybackEngine | null = null;
  private startedAt = 0;
  private maxPosition = 0;
  private listeners = new Set<Listener>();
  // Điểm đã nghe hết trong ngày: GPS chỉ gợi ý, không tự phát lại (mục 4.3.5).
  private completedToday = new Map<number, string>();
  autoPlay = true;

  constructor(private readonly deps: NarrationDeps) {}

  getState = (): NarrationState => this.state;

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  // Bấm tay / QR / số điểm: khách chủ động → dừng bài hiện tại và phát ngay.
  // GPS / mô phỏng: không cắt ngang → thẻ gợi ý + hàng đợi.
  request(item: NarrationItem, trigger: Trigger): "started" | "suggested" | "queued" | "ignored" {
    const automatic = trigger === "gps" || trigger === "simulated";
    if (!automatic) {
      this.play(item, trigger);
      return "started";
    }
    if (this.state.current?.placeId === item.placeId) return "ignored";
    const doneToday = this.completedToday.get(item.placeId) === this.today();
    if (!this.autoPlay || doneToday) {
      this.set({ suggestion: item });
      return "suggested";
    }
    if (this.state.status === "idle") {
      this.play(item, trigger);
      return "started";
    }
    const queue = this.state.queue.some((q) => q.placeId === item.placeId) ? this.state.queue : [...this.state.queue, item];
    this.set({ suggestion: item, queue });
    return "queued";
  }

  acceptSuggestion(trigger: Trigger = "gps"): void {
    const s = this.state.suggestion;
    if (s) this.play(s, trigger);
  }

  dismissSuggestion(): void {
    this.set({ suggestion: null });
  }

  pause(): void {
    if (this.state.status !== "playing") return;
    this.engine?.pause();
    this.set({ status: "paused" });
  }

  resume(): void {
    if (this.state.status !== "paused") return;
    this.engine?.resume();
    this.set({ status: "playing" });
  }

  toggle(): void {
    if (this.state.status === "playing") this.pause();
    else this.resume();
  }

  // Phát lại từ đầu (cũng dùng khi đổi ngôn ngữ giữa chừng: truyền bài ở ngôn ngữ mới).
  restart(item?: NarrationItem): void {
    const cur = this.state.current;
    if (!cur) return;
    this.play(item ?? cur, cur.trigger);
  }

  seekBy(deltaSec: number): void {
    this.engine?.seekBy?.(deltaSec);
  }

  setRate(rate: number): void {
    this.engine?.setRate?.(rate);
    this.set({ rate });
  }

  // Khách bấm dừng: ghi lượt ghé rồi về trạng thái rảnh (không tự phát hàng đợi).
  stop(): void {
    this.finishCurrent(false);
    this.set({ status: "idle", current: null, positionSec: 0, durationSec: 0, queue: [] });
  }

  private play(item: NarrationItem, trigger: Trigger): void {
    this.finishCurrent(false);
    const engine = this.deps.createEngine(item);
    this.engine = engine;
    this.startedAt = this.now();
    this.maxPosition = 0;
    this.set({
      status: "playing",
      current: { ...item, trigger, engine: engine.kind },
      positionSec: 0,
      durationSec: 0,
      error: null,
      failed: null,
      suggestion: this.state.suggestion?.placeId === item.placeId ? null : this.state.suggestion,
      queue: this.state.queue.filter((q) => q.placeId !== item.placeId),
    });
    this.deps.onStart?.(item, trigger);
    engine.start(item, this.state.rate, {
      onProgress: (positionSec, durationSec) => {
        if (this.engine !== engine) return;
        this.maxPosition = Math.max(this.maxPosition, positionSec);
        this.set({ positionSec, durationSec });
      },
      onEnd: () => {
        if (this.engine !== engine) return;
        this.finishCurrent(true);
        this.playNextInQueue();
      },
      onError: (message) => {
        if (this.engine !== engine) return;
        this.finishCurrent(false);
        this.set({ status: "idle", current: null, error: message, failed: item });
      },
    });
  }

  private playNextInQueue(): void {
    const isInside = this.deps.isStillInside ?? (() => true);
    const queue = this.state.queue.filter((q) => isInside(q.placeId));
    const next = queue[0];
    this.set({ status: "idle", current: null, positionSec: 0, durationSec: 0, queue: queue.slice(1) });
    if (next) this.play(next, "gps");
  }

  // Ghi lượt ghé cho bài đang phát (nếu có). ended = phát hết tự nhiên.
  private finishCurrent(ended: boolean): void {
    const cur = this.state.current;
    const engine = this.engine;
    if (!cur || !engine) return;
    this.engine = null;
    if (!ended) engine.stop();
    const duration = this.state.durationSec;
    const listenedSec = Math.round(ended && duration > 0 ? duration : this.maxPosition);
    const completed = ended || (duration > 0 && listenedSec >= COMPLETED_RATIO * duration);
    if (completed) this.completedToday.set(cur.placeId, this.today());
    this.deps.onVisit({
      placeId: cur.placeId, lang: cur.lang, trigger: cur.trigger, listenedSec, completed,
      startedAt: new Date(this.startedAt).toISOString(),
    });
  }

  private today(): string {
    return new Date(this.now()).toISOString().slice(0, 10);
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now();
  }

  private set(patch: Partial<NarrationState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }
}
