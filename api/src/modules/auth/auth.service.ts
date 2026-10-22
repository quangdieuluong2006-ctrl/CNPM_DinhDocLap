import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";
import { ApiError } from "../../lib/apiError.js";
import { logActivity } from "../activity/activity.service.js";
import { toUserDto, type UserDto } from "../users/user.dto.js";
import * as repo from "./auth.repository.js";
import type { ClientType } from "./auth.schemas.js";
import { hashToken, newRefreshToken, signAccessToken } from "./tokens.js";

const BCRYPT_COST = 10;
// Hash giả để so sánh khi email không tồn tại: thời gian phản hồi như nhau,
// kẻ tấn công không dò được email nào đã đăng ký.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-0", BCRYPT_COST);

export interface Session {
  accessToken: string;
  expiresIn: number; // giây
  refreshToken: string;
  user: UserDto;
}

async function issueSession(user: repo.UserRow): Promise<Session> {
  const { token, hash } = newRefreshToken();
  await repo.insertRefreshToken(user.id, hash, env.REFRESH_TOKEN_TTL_DAYS);
  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    expiresIn: env.ACCESS_TOKEN_TTL_MIN * 60,
    refreshToken: token,
    user: toUserDto(user),
  };
}

export async function register(
  input: { email: string; password: string; fullName: string; locale: "vi" | "en"; narrationLang?: string; clientType: ClientType },
  ip?: string,
): Promise<Session> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const id = await repo.insertUser({ ...input, passwordHash });
  if (id === undefined) throw new ApiError(409, "EMAIL_TAKEN", "Email đã được đăng ký");
  const user = await repo.findUserById(id);
  if (!user) throw new Error("Không đọc lại được user vừa tạo");
  await logActivity({ userId: id, action: "auth.register", entityType: "user", entityId: id, ip, detail: { clientType: input.clientType } });
  return issueSession(user);
}

export async function login(input: { email: string; password: string; clientType: ClientType }, ip?: string): Promise<Session> {
  const user = await repo.findUserByEmail(input.email);
  const passwordOk = await bcrypt.compare(input.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !user.password_hash || !passwordOk) {
    await logActivity({ userId: user?.id ?? null, action: "auth.login_failed", ip, detail: { email: input.email, clientType: input.clientType } });
    // Không tiết lộ email hay mật khẩu sai (PRD v1.0, FE-01).
    throw new ApiError(401, "AUTH_INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng");
  }
  // Chỉ báo "bị khóa" sau khi mật khẩu đúng, để không lộ trạng thái tài khoản cho người lạ.
  if (user.status === "locked") {
    throw new ApiError(403, "ACCOUNT_LOCKED", "Tài khoản đã bị khóa, vui lòng liên hệ hỗ trợ");
  }
  if (input.clientType === "admin" && user.role !== "admin") {
    throw new ApiError(403, "FORBIDDEN", "Tài khoản không có quyền truy cập trang quản trị");
  }
  await logActivity({ userId: user.id, action: "auth.login", entityType: "user", entityId: user.id, ip, detail: { clientType: input.clientType } });
  return issueSession(user);
}

// Xoay vòng (rotation): token cũ bị thu hồi, cấp cặp token mới.
// Token đã thu hồi mà bị dùng lại → coi như bị đánh cắp, thu hồi toàn bộ phiên của user.
export async function refresh(refreshToken: string, clientType: ClientType, ip?: string): Promise<Session> {
  const result = await repo.consumeRefreshToken(hashToken(refreshToken));
  if (result.kind === "reused") {
    await repo.revokeAllRefreshTokens(result.userId);
    await logActivity({ userId: result.userId, action: "auth.refresh_reuse", ip, detail: { clientType } });
  }
  if (result.kind !== "ok") {
    throw new ApiError(401, "AUTH_REFRESH_INVALID", "Phiên đăng nhập không còn hiệu lực, vui lòng đăng nhập lại");
  }
  const user = await repo.findUserById(result.userId);
  if (!user) throw new ApiError(401, "AUTH_REFRESH_INVALID", "Phiên đăng nhập không còn hiệu lực, vui lòng đăng nhập lại");
  if (user.status === "locked") {
    await repo.revokeAllRefreshTokens(user.id);
    throw new ApiError(403, "ACCOUNT_LOCKED", "Tài khoản đã bị khóa, vui lòng liên hệ hỗ trợ");
  }
  if (clientType === "admin" && user.role !== "admin") {
    throw new ApiError(403, "FORBIDDEN", "Tài khoản không có quyền truy cập trang quản trị");
  }
  return issueSession(user);
}

// Đăng xuất luôn thành công (idempotent), kể cả khi token đã hết hạn.
export async function logout(refreshToken: string | undefined, clientType: ClientType, ip?: string): Promise<void> {
  if (!refreshToken) return;
  const userId = await repo.revokeRefreshToken(hashToken(refreshToken));
  if (userId !== undefined) {
    await logActivity({ userId, action: "auth.logout", entityType: "user", entityId: userId, ip, detail: { clientType } });
  }
}

export async function getMe(userId: number): Promise<UserDto> {
  const user = await repo.findUserById(userId);
  if (!user) throw new ApiError(401, "AUTH_TOKEN_INVALID", "Tài khoản không còn tồn tại");
  // Access token vẫn còn hạn tối đa 15 phút sau khi bị khóa; /me chặn ngay để client đăng xuất.
  if (user.status === "locked") throw new ApiError(403, "ACCOUNT_LOCKED", "Tài khoản đã bị khóa, vui lòng liên hệ hỗ trợ");
  return toUserDto(user);
}
