import { z } from "zod";

export const clientTypeSchema = z.enum(["web", "admin", "mobile"]);
export type ClientType = z.infer<typeof clientTypeSchema>;

const email = z.string().trim().toLowerCase().pipe(z.email("Email không hợp lệ").max(255));
// Quy tắc mật khẩu theo PRD v1.0, FE-01: ≥ 8 ký tự, có cả chữ và số.
const password = z
  .string()
  .min(8, "Mật khẩu cần ít nhất 8 ký tự")
  .max(72, "Mật khẩu tối đa 72 ký tự") // bcrypt chỉ dùng 72 byte đầu
  .regex(/[A-Za-z]/, "Mật khẩu cần có chữ cái")
  .regex(/\d/, "Mật khẩu cần có chữ số");

export const registerSchema = z.object({
  email,
  password,
  fullName: z.string().trim().min(1, "Họ tên không được trống").max(100),
  locale: z.enum(["vi", "en"]).default("vi"), // ngôn ngữ giao diện
  narrationLang: z.string().trim().toLowerCase().max(10).optional(), // ngôn ngữ thuyết minh mặc định
  // Web Admin không có màn đăng ký: tài khoản admin chỉ do admin khác cấp.
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
