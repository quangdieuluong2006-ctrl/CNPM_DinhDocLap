import { describe, expect, it } from "vitest";
import { zoneStyle } from "../src/components/ZoneArt";
import { ZONES } from "../src/lib/i18n";

describe("ảnh thay thế theo khu vực (thẻ điểm chưa có ảnh)", () => {
  it("mỗi khu vực có màu riêng", () => {
    const bgs = ZONES.map((z) => zoneStyle(z).bg);
    expect(new Set(bgs).size).toBe(ZONES.length);
  });
  it("khu vực lạ → dùng kiểu ngoài trời, không lỗi", () => {
    expect(zoneStyle("unknown")).toBe(zoneStyle("outdoor"));
  });
});
