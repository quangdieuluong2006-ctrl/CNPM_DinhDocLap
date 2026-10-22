import type { UserRow } from "../auth/auth.repository.js";

// Dữ liệu người dùng trả cho client – không bao giờ chứa password_hash.
export function toUserDto(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role,
    status: u.status,
    uiLocale: u.ui_locale,
    narrationLang: u.narration_lang,
    createdAt: u.created_at,
  };
}
export type UserDto = ReturnType<typeof toUserDto>;
