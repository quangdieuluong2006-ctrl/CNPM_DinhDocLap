import { describe, expect, it } from "vitest";
import { scaledText, shouldCongratulate } from "../src/core/prefs";

describe("cỡ chữ văn bản (FE-12, TC-24)", () => {
  it("Vừa giữ cỡ gốc 16; Lớn to hơn, Nhỏ nhỏ hơn; khoảng cách dòng theo cỡ chữ", () => {
    expect(scaledText("medium")).toEqual({ fontSize: 16, lineHeight: 25 });
    expect(scaledText("large").fontSize).toBe(20);
    expect(scaledText("small").fontSize).toBe(14);
    expect(scaledText("large").lineHeight).toBeGreaterThan(scaledText("medium").lineHeight);
  });
});

describe("chúc mừng khi nghe đủ (FE-09, TC-22)", () => {
  const places = [1, 2, 3];
  it("nghe hết mọi điểm → chúc mừng", () => {
    expect(shouldCongratulate([3, 1, 2], places, false)).toBe(true);
  });
  it("còn thiếu điểm → chưa chúc mừng", () => {
    expect(shouldCongratulate([1, 2], places, false)).toBe(false);
  });
  it("đã chúc mừng rồi → không hiện lại", () => {
    expect(shouldCongratulate([1, 2, 3], places, true)).toBe(false);
  });
  it("chưa có gói nội dung (0 điểm) → không chúc mừng", () => {
    expect(shouldCongratulate([], [], false)).toBe(false);
  });
  it("điểm đã nghe nhưng nay bị ẩn không làm hỏng phép đếm", () => {
    expect(shouldCongratulate([1, 2, 3, 99], places, false)).toBe(true);
  });
});
