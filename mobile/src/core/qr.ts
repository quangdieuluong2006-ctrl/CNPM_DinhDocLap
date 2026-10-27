// Đọc số điểm từ nội dung mã QR (PRD v1.0, mục 4.4): https://<web-user>/p/201, dinhdoclap://p/201, hoặc "201".
export function parsePlaceCode(data: string): string | null {
  const s = data.trim();
  if (/^[0-9]{3}$/.test(s)) return s;
  const m = s.match(/\/p\/([0-9]{3})(?:[/?#]|$)/);
  return m?.[1] ?? null;
}
