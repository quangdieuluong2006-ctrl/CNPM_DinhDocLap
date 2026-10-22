import { randomBytes, timingSafeEqual } from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import { env } from "../../config/env.js";
import { ApiError } from "../../lib/apiError.js";
import type { ClientType } from "./auth.schemas.js";

// Web User và Web Admin có cookie riêng: trên localhost cookie không phân biệt cổng,
// nếu dùng chung tên thì đăng nhập admin sẽ ghi đè phiên user (và ngược lại).
type BrowserClient = Exclude<ClientType, "mobile">;
const refreshCookie = (c: BrowserClient) => `rt_${c}`;
const csrfCookie = (c: BrowserClient) => `csrf_${c}`;

function baseOptions(): CookieOptions {
  return { sameSite: "lax", secure: env.COOKIE_SECURE, maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000 };
}

// Refresh token: HttpOnly (JavaScript không đọc được), chỉ gửi kèm tới /api/v1/auth.
// CSRF token: JavaScript đọc được để gửi lại qua header X-CSRF-Token (double-submit, PRD mục 11.1).
export function setSessionCookies(res: Response, client: BrowserClient, refreshToken: string): string {
  const csrf = randomBytes(24).toString("base64url");
  res.cookie(refreshCookie(client), refreshToken, { ...baseOptions(), httpOnly: true, path: "/api/v1/auth" });
  res.cookie(csrfCookie(client), csrf, { ...baseOptions(), httpOnly: false, path: "/" });
  return csrf;
}

export function clearSessionCookies(res: Response, client: BrowserClient): void {
  const { maxAge: _ignored, ...opts } = baseOptions();
  res.clearCookie(refreshCookie(client), { ...opts, httpOnly: true, path: "/api/v1/auth" });
  res.clearCookie(csrfCookie(client), { ...opts, path: "/" });
}

// Đọc refresh token từ cookie và kiểm tra header X-CSRF-Token khớp cookie csrf_*.
// Trang web lạ có thể khiến trình duyệt gửi cookie, nhưng không đọc được giá trị CSRF để đặt header.
export function readBrowserRefreshToken(req: Request, client: BrowserClient): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined>;
  const token = cookies[refreshCookie(client)];
  if (!token) return undefined;
  const expected = cookies[csrfCookie(client)];
  const sent = req.get("x-csrf-token");
  if (!expected || !sent || !safeEqual(expected, sent)) {
    throw new ApiError(403, "CSRF_INVALID", "Thiếu hoặc sai CSRF token");
  }
  return token;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
