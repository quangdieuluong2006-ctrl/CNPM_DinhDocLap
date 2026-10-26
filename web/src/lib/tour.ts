// Mã nhóm: đúng 6 ký tự A–Z, 0–9 (khớp kiểm tra của API). Bỏ khoảng trắng, gạch nối… người dùng gõ hoặc dán kèm.
export function normalizeTourCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}
