// Lớp gọi API của Web User (PRD v1.0, mục 6, 11). Mọi lỗi chuẩn hóa về ApiError { status, code, message }.
import type { Trigger } from "./types";

export const API_ROOT = import.meta.env.VITE_API_BASE_URL ?? "";
export const API_BASE = API_ROOT + "/api/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string; details?: unknown } };
    if (body.error?.code) return new ApiError(res.status, body.error.code, body.error.message ?? body.error.code, body.error.details);
  } catch {
    // body không phải JSON
  }
  return new ApiError(res.status, "HTTP_" + res.status, `Lỗi máy chủ (${res.status})`);
}

export async function rawFetch(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(API_BASE + path, { credentials: "include", ...init });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Không kết nối được máy chủ");
  }
}

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: "user" | "guide" | "admin";
  status: "active" | "locked";
  uiLocale: "vi" | "en";
  narrationLang: string | null;
  isGuest: boolean;
  createdAt: string;
}

export interface Session {
  accessToken: string;
  expiresIn: number;
  csrfToken: string;
  user: User;
}

// Phiên đăng nhập (giống Web Admin, PRD v1.0 mục 11.1): access token chỉ giữ trong bộ nhớ;
// refresh token nằm trong cookie HttpOnly rt_web; gửi kèm X-CSRF-Token (đọc từ cookie csrf_web) khi làm mới.
let accessToken: string | null = null;
let csrfToken: string | null = null;
let refreshing: Promise<Session> | null = null;
let onSessionExpired: (() => void) | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

function remember(s: Session): Session {
  accessToken = s.accessToken;
  csrfToken = s.csrfToken;
  return s;
}

export function clearSession(): void {
  accessToken = null;
  csrfToken = null;
}

function readCsrf(): string | null {
  if (csrfToken) return csrfToken;
  const m = document.cookie.match(/(?:^|;\s*)csrf_web=([^;]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

async function postSession(path: string, body: unknown, withCsrf = false): Promise<Session> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (withCsrf) headers["X-CSRF-Token"] = readCsrf() ?? "";
  const res = await rawFetch(path, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw await toApiError(res);
  return remember((await res.json()) as Session);
}

// Khách ẩn danh: không email/mật khẩu, API tạo khách mới và cấp phiên (refresh token trong cookie rt_web).
export function startGuest(narrationLang: string | undefined, locale: "vi" | "en"): Promise<Session> {
  return postSession("/auth/guest", { clientType: "web", narrationLang, locale });
}

// Single-flight: nhiều request cùng hết hạn token thì chỉ gọi /auth/refresh một lần.
export function refreshSession(): Promise<Session> {
  refreshing ??= postSession("/auth/refresh", { clientType: "web" }, true)
    .catch((err: unknown) => {
      clearSession();
      throw err;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// Gọi API cần đăng nhập; gặp 401 hết hạn → làm mới một lần rồi gửi lại.
export async function authRequest<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const send = () => {
    const headers: Record<string, string> = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    return rawFetch(path, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
  };
  let res = await send();
  if (res.status === 401) {
    const err = await toApiError(res);
    if (err.code !== "AUTH_TOKEN_EXPIRED" && err.code !== "AUTH_REQUIRED") throw err;
    try {
      await refreshSession();
    } catch (refreshErr) {
      onSessionExpired?.();
      throw refreshErr;
    }
    res = await send();
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Gọi API công khai (không cần đăng nhập)
export async function publicGet<T>(path: string): Promise<T> {
  const res = await rawFetch(path);
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

// Ảnh/âm thanh trả về dạng "/media/…"
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : API_ROOT + path;
}

export interface VisitInput {
  placeId: number;
  lang: string;
  trigger: Trigger;
  listenedSec: number;
  completed: boolean;
  startedAt: string;
}

// Ghi lượt nghe (khách chưa đăng nhập vẫn ghi được; đã đăng nhập thì gắn vào tài khoản để hiện trong lịch sử).
// keepalive: vẫn gửi được khi người dùng rời trang. Lỗi ghi lượt nghe không làm hỏng trải nghiệm nghe nên chỉ bỏ qua.
export function sendVisit(v: VisitInput): void {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  void fetch(API_BASE + "/visits", {
    method: "POST",
    headers,
    keepalive: true,
    credentials: "include",
    body: JSON.stringify({ ...v, clientId: crypto.randomUUID() }),
  }).catch(() => undefined);
}
