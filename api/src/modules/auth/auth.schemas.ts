import { z } from "zod";

export const clientTypeSchema = z.enum(["web", "admin", "mobile"]);
export type ClientType = z.infer<typeof clientTypeSchema>;

const email = z.string().trim().toLowerCase().pipe(z.email("Email không hợp lệ").max(255));
// Khách ẩn danh (Web User, Mobile): dùng ngay, không email/mật khẩu.
export const guestSchema = z.object({
  locale: z.enum(["vi", "en"]).default("vi"),
  narrationLang: z.string().trim().toLowerCase().max(10).optional(),
  clientType: z.enum(["web", "mobile"]).default("web"),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
  clientType: clientTypeSchema.default("web"),
});

// Web/Admin: refresh token nằm trong cookie HttpOnly; Mobile: gửi trong body.
export const refreshSchema = z.object({
  clientType: clientTypeSchema.default("web"),
  refreshToken: z.string().min(1).max(200).optional(),
});
