// Lớp gọi API duy nhất của Web Admin (PRD v1.0, mục 7, 11):
// - access token chỉ giữ trong bộ nhớ; refresh token nằm trong cookie HttpOnly rt_admin
// - gặp 401 AUTH_TOKEN_EXPIRED → làm mới MỘT lần (single-flight) rồi gửi lại request
// - mọi lỗi chuẩn hóa về ApiError { status, code, message }

export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "") + "/api/v1";

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

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: "user" | "guide" | "admin";
  status: "active" | "locked";
  uiLocale: "vi" | "en";
  narrationLang: string | null;
}
export interface Session {
  accessToken: string;
  expiresIn: number;
  csrfToken: string;
  user: User;
}

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

function rememberSession(s: Session): Session {
  accessToken = s.accessToken;
  csrfToken = s.csrfToken;
  return s;
}

export function clearSession(): void {
  accessToken = null;
  csrfToken = null;
}

// Sau khi tải lại trang, csrfToken trong bộ nhớ mất → đọc lại từ cookie csrf_admin (không HttpOnly).
function readCsrf(): string | null {
  if (csrfToken) return csrfToken;
  const m = document.cookie.match(/(?:^|;\s*)csrf_admin=([^;]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string; details?: unknown } };
    if (body.error?.code) return new ApiError(res.status, body.error.code, body.error.message ?? body.error.code, body.error.details);
  } catch {
    // body không phải JSON
  }
  return new ApiError(res.status, "HTTP_" + res.status, `Lỗi máy chủ (${res.status})`);
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(API_BASE + path, { credentials: "include", ...init });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Không kết nối được máy chủ");
  }
}

export async function login(email: string, password: string): Promise<Session> {
  const res = await rawFetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, clientType: "admin" }),
  });
  if (!res.ok) throw await toApiError(res);
  return rememberSession((await res.json()) as Session);
}

// Single-flight: nhiều request cùng hết hạn token thì chỉ có một lần gọi /auth/refresh.
export function refreshSession(): Promise<Session> {
  refreshing ??= (async () => {
    try {
      const res = await rawFetch("/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": readCsrf() ?? "" },
        body: JSON.stringify({ clientType: "admin" }),
      });
      if (!res.ok) {
        clearSession();
        throw await toApiError(res);
      }
      return rememberSession((await res.json()) as Session);
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function logout(): Promise<void> {
  try {
    await rawFetch("/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": readCsrf() ?? "" },
      body: JSON.stringify({ clientType: "admin" }),
    });
  } finally {
    clearSession();
  }
}

// Gửi request có access token; gặp 401 hết hạn → làm mới một lần rồi gửi lại.
export async function apiRequest<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  const send = () => {
    const headers: Record<string, string> = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
    if (init.body !== undefined && !isForm) headers["Content-Type"] = "application/json";
    return rawFetch(path, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : isForm ? (init.body as FormData) : JSON.stringify(init.body),
    });
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

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

// Ảnh/âm thanh trả về dạng "/media/…": khi dev, Vite chuyển tiếp /media tới API.
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : (import.meta.env.VITE_API_BASE_URL ?? "") + path;
}
