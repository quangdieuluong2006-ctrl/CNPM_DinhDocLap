import { describe, expect, it } from "vitest";
import { slugify } from "../src/lib/slug";

describe("slugify", () => {
  it("bỏ dấu tiếng Việt, đ → d, khoảng trắng → gạch ngang", () => {
    expect(slugify("Phòng Trình Quốc thư")).toBe("phong-trinh-quoc-thu");
    expect(slugify("  Đường hầm – Bộ chỉ huy  ")).toBe("duong-ham-bo-chi-huy");
    expect(slugify("Xe tăng 390 & 843")).toBe("xe-tang-390-843");
  });
});
