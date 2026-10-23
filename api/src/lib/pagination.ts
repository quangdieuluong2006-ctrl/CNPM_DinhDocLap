import { z } from "zod";

// Quy ước phân trang chung: ?page=1&pageSize=20 → { items, page, pageSize, total } (PRD v1.0, mục 11.1).
export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export function offsetOf(p: { page: number; pageSize: number }): number {
  return (p.page - 1) * p.pageSize;
}
