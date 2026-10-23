import { describe, expect, it } from "vitest";
import { fold, matchLanguage } from "../src/lib/i18n";

const ja = { code: "ja", nameVi: "Tiếng Nhật", nameEn: "Japanese", nameNative: "日本語" };

describe("tìm ngôn ngữ (FE-02 AC1 áp dụng cho web)", () => {
  it('gõ "nhat", "japanese", "日本", "ja" đều ra tiếng Nhật', () => {
    for (const q of ["nhat", "Nhật", "japanese", "日本", "ja"]) expect(matchLanguage(ja, q)).toBe(true);
    expect(matchLanguage(ja, "han")).toBe(false);
  });
  it("bỏ dấu tiếng Việt, kể cả đ", () => {
    expect(fold("Phòng Trình Quốc thư – Đường hầm")).toBe("phong trinh quoc thu – duong ham");
  });
});
