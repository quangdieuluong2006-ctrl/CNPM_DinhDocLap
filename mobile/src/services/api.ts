// Gọi API Backend (PRD v1.0, mục 11). Lỗi trả về dạng { error: { code, message } } → ném ApiError.
export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly details?: unknown) {
    super(message);
  }
}

export interface Language {
  code: string;
  nameVi: string;
  nameEn: string;
  nameNative: string;
  ttsLocale: string;
  completeness: number;
  approved: number;
  pending: number;
}

export interface PlaceContent {
  lang: string;
  isFallback: boolean;
  title: string;
  summary: string;
  body?: string;
  status: "approved" | "pending";
  audioUrl: string | null;
  audioDurationSec: number | null;
  audioBytes: number | null;
}

export interface Place {
  id: number;
  code: string;
  slug: string;
  trigger: "gps" | "indoor";
  zone: "outdoor" | "ground" | "floor1" | "floor2" | "rooftop" | "basement";
  lat: number;
  lng: number;
  radiusM: number;
  priority: number;
  sortOrder: number;
  imageUrl: string | null;
  content: PlaceContent | null;
}

export interface ContentBundle {
  version: number;
  publishedAt: string | null;
  lang: string;
  ttsLocale: string | null;
  places: Place[];
  totalAudioBytes: number;
}

export interface VisitPayload {
  clientId: string;
  placeId: number;
  lang: string;
  trigger: "gps" | "qr" | "code" | "manual" | "simulated";
  listenedSec: number;
  completed: boolean;
  startedAt: string;
}

const TIMEOUT_MS = 8000;

export function createApi(getBaseUrl: () => string, getToken: () => string | null = () => null) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<{ status: number; body: T; etag: string | null }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const headers: Record<string, string> = { Accept: "application/json", ...(init.headers as Record<string, string>) };
    if (init.body) headers["Content-Type"] = "application/json";
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      const res = await fetch(`${getBaseUrl()}/api/v1${path}`, { ...init, headers, signal: controller.signal });
      if (res.status === 304) return { status: 304, body: undefined as T, etag: res.headers.get("etag") };
      const text = await res.text();
      const body = text ? (JSON.parse(text) as unknown) : undefined;
      if (!res.ok) {
        const e = (body as { error?: { code?: string; message?: string; details?: unknown } } | undefined)?.error;
        throw new ApiError(res.status, e?.code ?? "HTTP_ERROR", e?.message ?? `Lỗi ${res.status}`, e?.details);
      }
      return { status: res.status, body: body as T, etag: res.headers.get("etag") };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, "NETWORK_ERROR", "Không kết nối được máy chủ");
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    baseUrl: getBaseUrl,
    // URL tuyệt đối cho ảnh/âm thanh trả về dạng "/media/…"
    mediaUrl: (path: string | null) => (path ? (path.startsWith("http") ? path : `${getBaseUrl()}${path}`) : null),
    languages: async () => (await request<{ items: Language[] }>("/languages")).body.items,
    place: async (code: string, lang: string) => (await request<Place & { languages: string[] }>(`/places/${code}?lang=${lang}`)).body,
    // Trả null nếu gói không đổi (304)
    bundle: async (lang: string, etag?: string | null) => {
      const r = await request<ContentBundle>(`/content/bundle?lang=${lang}`, { headers: etag ? { "If-None-Match": etag } : {} });
      return r.status === 304 ? null : { bundle: r.body, etag: r.etag };
    },
    sendVisits: async (visits: VisitPayload[]) =>
      (await request<{ accepted: number; duplicates: number; rejected: number }>("/visits/batch", {
        method: "POST",
        body: JSON.stringify({ visits }),
      })).body,
  };
}

export type Api = ReturnType<typeof createApi>;
