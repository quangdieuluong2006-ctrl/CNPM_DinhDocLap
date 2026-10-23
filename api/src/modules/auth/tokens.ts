import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { ApiError } from "../../lib/apiError.js";

export type Role = "user" | "guide" | "admin";
export interface AccessTokenPayload {
  sub: number;
  role: Role;
}

// Access token: JWT ngắn hạn (mặc định 15 phút), chỉ giữ trong bộ nhớ phía client.
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign({ role: payload.role }, env.JWT_ACCESS_SECRET, {
    subject: String(payload.sub),
    expiresIn: env.ACCESS_TOKEN_TTL_MIN * 60,
    algorithm: "HS256",
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ["HS256"] }) as jwt.JwtPayload;
    const sub = Number(decoded.sub);
    if (!Number.isInteger(sub) || !["user", "guide", "admin"].includes(decoded.role as string)) throw new Error("payload");
    return { sub, role: decoded.role as Role };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, "AUTH_TOKEN_EXPIRED", "Phiên đăng nhập đã hết hạn");
    }
    throw new ApiError(401, "AUTH_TOKEN_INVALID", "Token không hợp lệ");
  }
}

// Refresh token: chuỗi ngẫu nhiên 256 bit (không phải JWT). CSDL chỉ lưu SHA-256 của nó,
// nên lộ CSDL cũng không dùng được token.
export function newRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
