import { type Request, type Response, Router } from "express";
import { rateLimit } from "express-rate-limit";
import { env } from "../../config/env.js";
import { ApiError } from "../../lib/apiError.js";
import { clearSessionCookies, readBrowserRefreshToken, setSessionCookies } from "./auth.cookies.js";
import { type ClientType, loginSchema, refreshSchema, registerSchema } from "./auth.schemas.js";
import * as auth from "./auth.service.js";

// Web/Admin: refresh token chỉ nằm trong cookie, body trả csrfToken.
// Mobile: không dùng cookie, body trả refreshToken để lưu vào expo-secure-store.
function sendSession(res: Response, status: number, clientType: ClientType, s: auth.Session) {
  const { refreshToken, ...rest } = s;
  if (clientType === "mobile") {
    res.status(status).json({ ...rest, refreshToken });
  } else {
    const csrfToken = setSessionCookies(res, clientType, refreshToken);
    res.status(status).json({ ...rest, csrfToken });
  }
}

function refreshTokenFrom(req: Request, clientType: ClientType, bodyToken: string | undefined) {
  return clientType === "mobile" ? bodyToken : readBrowserRefreshToken(req, clientType);
}

export function authRouter(opts: { loginRateLimitMax?: number } = {}) {
  const router = Router();

  // Chống dò mật khẩu: tối đa N lần đăng nhập THẤT BẠI / 15 phút / IP (PRD v1.0, mục 15.1).
  // Đăng nhập thành công không bị đếm, để nhiều tài khoản demo trên cùng máy không tự khóa nhau.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: opts.loginRateLimitMax ?? env.LOGIN_RATE_LIMIT_MAX,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res, next) => {
      // express-rate-limit đã đặt header Retry-After; client dùng nó để đếm ngược.
      const retryAfter = Number(res.getHeader("retry-after")) || undefined;
      next(new ApiError(429, "RATE_LIMITED", "Bạn đã thử quá nhiều lần, vui lòng thử lại sau", { retryAfter }));
    },
  });

  router.post("/auth/register", async (req, res) => {
    const input = registerSchema.parse(req.body);
    sendSession(res, 201, input.clientType, await auth.register(input, req.ip));
  });

  router.post("/auth/login", loginLimiter, async (req, res) => {
    const input = loginSchema.parse(req.body);
    sendSession(res, 200, input.clientType, await auth.login(input, req.ip));
  });

  router.post("/auth/refresh", async (req, res) => {
    const { clientType, refreshToken } = refreshSchema.parse(req.body ?? {});
    const token = refreshTokenFrom(req, clientType, refreshToken);
    try {
      if (!token) throw new ApiError(401, "AUTH_REFRESH_INVALID", "Phiên đăng nhập không còn hiệu lực, vui lòng đăng nhập lại");
      sendSession(res, 200, clientType, await auth.refresh(token, clientType, req.ip));
    } catch (err) {
      // Refresh thất bại thì xóa cookie hỏng để trình duyệt không gửi lại mãi.
      if (clientType !== "mobile" && err instanceof ApiError && err.status !== 500) clearSessionCookies(res, clientType);
      throw err;
    }
  });

  router.post("/auth/logout", async (req, res) => {
    const { clientType, refreshToken } = refreshSchema.parse(req.body ?? {});
    await auth.logout(refreshTokenFrom(req, clientType, refreshToken), clientType, req.ip);
    if (clientType !== "mobile") clearSessionCookies(res, clientType);
    res.status(204).end();
  });

  return router;
}
