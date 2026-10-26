import { describe, expect, it } from "vitest";
import { normalizeTourCode } from "../src/lib/tour";

describe("mã nhóm tham quan (FE-16)", () => {
  it("viết hoa, bỏ khoảng trắng và ký tự lạ", () => {
    expect(normalizeTourCode(" ab 12-cd ")).toBe("AB12CD");
  });
  it("cắt còn 6 ký tự khi dán chuỗi dài", () => {
    expect(normalizeTourCode("abc123xyz")).toBe("ABC123");
  });
  it("bỏ chữ có dấu tiếng Việt", () => {
    expect(normalizeTourCode("ĐOÀN")).toBe("ON");
  });
});
