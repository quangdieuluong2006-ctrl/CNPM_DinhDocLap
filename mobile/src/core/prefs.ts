// FE-12 Cài đặt (cỡ chữ) và FE-09 Tiến độ (chúc mừng khi nghe đủ). Thuần TypeScript để kiểm thử bằng Vitest.

export type TextSize = "small" | "medium" | "large";
export const TEXT_SIZES: TextSize[] = ["small", "medium", "large"];

// Hệ số phóng chữ cho văn bản thuyết minh (chi tiết điểm, trình phát). "medium" = cỡ gốc 16.
const SCALE: Record<TextSize, number> = { small: 0.875, medium: 1, large: 1.25 };

export function scaledText(size: TextSize, base = 16): { fontSize: number; lineHeight: number } {
  const fontSize = Math.round(base * (SCALE[size] ?? 1));
  return { fontSize, lineHeight: Math.round(fontSize * 1.55) };
}

// Hiện hộp thoại chúc mừng đúng một lần: khi mọi điểm đang xuất bản đều đã nghe hết và chưa chúc mừng trước đó.
// Gói nội dung chưa tải (0 điểm) thì không chúc mừng.
export function shouldCongratulate(completedIds: readonly number[], placeIds: readonly number[], alreadyShown: boolean): boolean {
  if (alreadyShown || placeIds.length === 0) return false;
  const done = new Set(completedIds);
  return placeIds.every((id) => done.has(id));
}
