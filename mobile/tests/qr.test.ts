import { describe, expect, it } from "vitest";
import { parsePlaceCode } from "../src/core/qr";

describe("đọc mã QR (FE-06)", () => {
  it("nhận liên kết web, deep link và số trơn", () => {
    expect(parsePlaceCode("https://dinhdoclap.vercel.app/p/201")).toBe("201");
    expect(parsePlaceCode("http://192.168.1.22:5173/p/101?lang=en")).toBe("101");
    expect(parsePlaceCode("dinhdoclap://p/901")).toBe("901");
    expect(parsePlaceCode(" 401 ")).toBe("401");
  });
  it("từ chối mã không thuộc hệ thống", () => {
    expect(parsePlaceCode("https://example.com/abc")).toBeNull();
    expect(parsePlaceCode("https://x.vn/p/2011")).toBeNull();
    expect(parsePlaceCode("WIFI:S:guest;;")).toBeNull();
  });
});
