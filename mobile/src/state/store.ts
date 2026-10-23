import { useSyncExternalStore } from "react";
import { getLocales } from "expo-localization";
import { distanceM, type LatLng } from "../core/geo";
import { type Fix, GeofenceEngine, type GeoPlace } from "../core/geofence";
import { NarrationController, type NarrationItem, type Trigger } from "../core/narration";
import { createApi, type Language, type Place } from "../services/api";
import { defaultApiUrl, FAR_FROM_PALACE_M, PALACE_CENTER } from "../services/config";
import { type LocationProvider, RealLocationProvider, SimulatedLocationProvider } from "../services/location";
import { configureAudio, createEngine } from "../services/playback";
import { downloadAudio, getJson, loadBundle, saveBundle, setJson, type StoredBundle } from "../services/storage";
import { enqueueVisit, flushVisits, pendingVisits } from "../services/visits";
import type { UiLocale } from "../i18n";

export interface Settings {
  narrationLang: string | null; // null = chưa chọn → mở màn hình chọn ngôn ngữ
  uiLocale: UiLocale;
  autoPlay: boolean;
  simulate: boolean;
  apiUrl: string | null; // null = tự suy ra (services/config.ts)
}

export interface AppState {
  ready: boolean;
  settings: Settings;
  languages: Language[];
  stored: StoredBundle | null;
  loadingBundle: boolean;
  online: boolean;
  error: string | null;
  fix: Fix | null;
  locationError: string | null;
  weakGps: boolean;
  completed: number[]; // id điểm đã nghe hết (tiến độ FE-09)
  pendingVisits: number;
  download: { done: number; total: number } | null;
}

const deviceLocale = getLocales()[0]?.languageCode ?? "vi";
const DEFAULT_SETTINGS: Settings = {
  narrationLang: null,
  uiLocale: deviceLocale === "vi" ? "vi" : "en",
  autoPlay: true,
  simulate: false,
  apiUrl: null,
};

// Toàn bộ trạng thái ứng dụng trong một store (không phụ thuộc React) + hook useApp() để màn hình đọc.
class AppStore {
  state: AppState = {
    ready: false, settings: DEFAULT_SETTINGS, languages: [], stored: null, loadingBundle: false, online: true,
    error: null, fix: null, locationError: null, weakGps: false, completed: [], pendingVisits: 0, download: null,
  };
  private listeners = new Set<() => void>();
  readonly api = createApi(() => this.state.settings.apiUrl ?? defaultApiUrl());
  private geofence = new GeofenceEngine([]);
  private provider: LocationProvider | null = null;
  readonly sim = new SimulatedLocationProvider(PALACE_CENTER);
  readonly narration = new NarrationController({
    createEngine,
    onVisit: (v) => void this.recordVisit(v),
    onStart: (item, trigger) => {
      if (trigger === "gps" || trigger === "simulated") this.geofence.markAutoPlayed(item.placeId);
    },
    isStillInside: (placeId) => this.geofence.isInside(placeId),
  });

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.state;

  private set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  async init(): Promise<void> {
    const settings = { ...DEFAULT_SETTINGS, ...(await getJson<Partial<Settings>>("settings", {})) };
    const completed = await getJson<number[]>("progress.completed", []);
    this.narration.autoPlay = settings.autoPlay;
    const stored = settings.narrationLang ? await loadBundle(settings.narrationLang) : null;
    this.set({ settings, completed, stored, pendingVisits: await pendingVisits() });
    this.applyBundle();
    this.set({ ready: true });
    void configureAudio().catch(() => undefined);
    void this.refreshLanguages();
    if (settings.narrationLang) void this.refreshBundle();
    void this.syncVisits();
    await this.startLocation();
  }

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    const settings = { ...this.state.settings, ...patch };
    this.set({ settings });
    await setJson("settings", settings);
    if (patch.autoPlay !== undefined) this.narration.autoPlay = patch.autoPlay;
    if (patch.simulate !== undefined) await this.startLocation();
    if (patch.apiUrl !== undefined) {
      void this.refreshLanguages();
      void this.refreshBundle();
    }
  }

  async refreshLanguages(): Promise<void> {
    try {
      const languages = await this.api.languages();
      await setJson("languages", languages);
      this.set({ languages, online: true });
    } catch {
      this.set({ languages: await getJson<Language[]>("languages", this.state.languages), online: false });
    }
  }

  // Chọn ngôn ngữ thuyết minh: đọc gói đã lưu (offline) rồi kiểm tra bản mới trên máy chủ.
  async setLanguage(lang: string): Promise<void> {
    await this.updateSettings({ narrationLang: lang });
    this.set({ stored: await loadBundle(lang) });
    this.applyBundle();
    await this.refreshBundle();
    // Đổi ngôn ngữ khi đang nghe: phát lại bài hiện tại từ đầu bằng ngôn ngữ mới (FE-07 AC2).
    const cur = this.narration.getState().current;
    const place = cur ? this.places.find((p) => p.id === cur.placeId) : undefined;
    const item = place ? this.toItem(place) : null;
    if (item) this.narration.restart(item);
  }

  // Tải gói nội dung với ETag: không đổi → 304, giữ bản cũ (PRD v1.0, mục 4.6.3).
  async refreshBundle(): Promise<void> {
    const lang = this.state.settings.narrationLang;
    if (!lang) return;
    this.set({ loadingBundle: true, error: null });
    try {
      const prev = this.state.stored?.bundle.lang === lang ? this.state.stored : null;
      const res = await this.api.bundle(lang, prev?.etag);
      if (res) {
        const stored: StoredBundle = { bundle: res.bundle, etag: res.etag, savedAt: new Date().toISOString(), audioFiles: prev?.audioFiles ?? {} };
        await saveBundle(stored).catch(() => undefined);
        this.set({ stored });
        this.applyBundle();
      }
      this.set({ online: true });
    } catch (err) {
      this.set({ online: false, error: this.state.stored ? null : (err as Error).message });
    } finally {
      this.set({ loadingBundle: false });
    }
  }

  async downloadOfflineAudio(): Promise<void> {
    const stored = this.state.stored;
    if (!stored) return;
    const urls = stored.bundle.places.flatMap((p) => {
      const url = this.api.mediaUrl(p.content?.audioUrl ?? null);
      return url ? [{ url, name: url.split("/").pop()! }] : [];
    });
    this.set({ download: { done: 0, total: urls.length } });
    try {
      const files = await downloadAudio(stored.bundle.lang, urls, (done, total) => this.set({ download: { done, total } }));
      const next = { ...stored, audioFiles: { ...stored.audioFiles, ...files } };
      await saveBundle(next);
      this.set({ stored: next });
    } finally {
      this.set({ download: null });
    }
  }

  get places(): Place[] {
    return this.state.stored?.bundle.places ?? [];
  }

  findPlace(code: string): Place | undefined {
    return this.places.find((p) => p.code === code);
  }

  // Ghép bài thuyết minh thành mục phát: ưu tiên tệp đã tải về máy, sau đó URL trên máy chủ, cuối cùng giọng tổng hợp.
  toItem(place: Place): NarrationItem | null {
    const c = place.content;
    if (!c) return null;
    const stored = this.state.stored;
    const remote = this.api.mediaUrl(c.audioUrl);
    const local = remote ? stored?.audioFiles[remote] : undefined;
    const ttsLocale = c.isFallback ? (c.lang === "en" ? "en-US" : "vi-VN") : (stored?.bundle.ttsLocale ?? c.lang);
    return {
      placeId: place.id, code: place.code, title: c.title, lang: c.lang, ttsLocale,
      text: `${c.title}. ${c.body ?? c.summary}`,
      audioUri: local ?? (this.state.online ? remote : null),
    };
  }

  play(place: Place, trigger: Trigger): void {
    const item = this.toItem(place);
    if (item) this.narration.request(item, trigger);
  }

  private applyBundle(): void {
    const gps: GeoPlace[] = this.places
      .filter((p) => p.trigger === "gps")
      .map((p) => ({ id: p.id, code: p.code, lat: p.lat, lng: p.lng, radiusM: p.radiusM, priority: p.priority }));
    this.geofence.setPlaces(gps);
  }

  // Chuyển giữa GPS thật và mô phỏng; logic geofence dùng chung (PRD v1.0, mục 4.8).
  async startLocation(): Promise<void> {
    this.provider?.stop();
    this.geofence.reset();
    this.set({ locationError: null });
    const provider: LocationProvider = this.state.settings.simulate ? this.sim : new RealLocationProvider();
    this.provider = provider;
    await provider.start(
      (fix) => this.onFix(fix),
      (message) => this.set({ locationError: message }),
    );
  }

  private onFix(fix: Fix): void {
    this.set({ fix, weakGps: false });
    if (distanceM(fix, PALACE_CENTER) > FAR_FROM_PALACE_M) return; // ở xa khuôn viên → không tự phát
    const r = this.geofence.process(fix);
    if (!r.accepted) {
      this.set({ weakGps: this.geofence.isWeakSignal() });
      return;
    }
    if (r.trigger) {
      const place = this.places.find((p) => p.id === r.trigger!.id);
      if (place) this.play(place, this.state.settings.simulate ? "simulated" : "gps");
    }
  }

  get isFarAway(): boolean {
    const f = this.state.fix;
    return !!f && !this.state.settings.simulate && distanceM(f, PALACE_CENTER) > FAR_FROM_PALACE_M;
  }

  distanceTo(p: LatLng): number | null {
    return this.state.fix ? distanceM(this.state.fix, p) : null;
  }

  private async recordVisit(v: Parameters<typeof enqueueVisit>[0]): Promise<void> {
    if (v.completed && !this.state.completed.includes(v.placeId)) {
      const completed = [...this.state.completed, v.placeId];
      this.set({ completed });
      await setJson("progress.completed", completed);
    }
    await enqueueVisit(v);
    await this.syncVisits();
  }

  async syncVisits(): Promise<void> {
    await flushVisits(this.api);
    this.set({ pendingVisits: await pendingVisits() });
  }
}

export const store = new AppStore();

export function useApp(): AppState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

export function useNarration() {
  return useSyncExternalStore(store.narration.subscribe, store.narration.getState);
}
