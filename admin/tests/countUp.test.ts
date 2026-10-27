import { describe, expect, it } from "vitest";
import { easeOutCubic } from "../src/lib/useCountUp";

describe("hiệu ứng số đếm dần (Dashboard)", () => {
  it("bắt đầu ở 0, kết thúc đúng 1", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });
  it("chạy nhanh lúc đầu, chậm dần về cuối", () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
    expect(easeOutCubic(0.25)).toBeLessThan(easeOutCubic(0.5));
  });
});
