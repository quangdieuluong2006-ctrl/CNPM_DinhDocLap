import type { RequestHandler } from "express";
import { ApiError } from "../lib/apiError.js";
import { type AccessTokenPayload, type Role, verifyAccessToken } from "../modules/auth/tokens.js";

declare module "express-serve-static-core" {
  interface Locals {
    auth?: AccessTokenPayload;
  }
}

// Bắt buộc header "Authorization: Bearer <accessToken>"; gắn { sub, role } vào res.locals.auth.
export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.get("authorization");
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  if (!match?.[1]) {
    next(new ApiError(401, "AUTH_REQUIRED", "Bạn cần đăng nhập"));
    return;
  }
  try {
    res.locals.auth = verifyAccessToken(match[1]);
    next();
  } catch (err) {
    next(err);
  }
};

// Dùng sau requireAuth, ví dụ: router.use(requireAuth, requireRole("admin")) hoặc requireRole("guide", "admin").
export function requireRole(...roles: Role[]): RequestHandler {
  return (_req, res, next) => {
    const role = res.locals.auth?.role;
    if (!role || !roles.includes(role)) {
      next(new ApiError(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này"));
      return;
    }
    next();
  };
}

export function currentUser(locals: { auth?: AccessTokenPayload }): AccessTokenPayload {
  if (!locals.auth) throw new ApiError(401, "AUTH_REQUIRED", "Bạn cần đăng nhập");
  return locals.auth;
}
