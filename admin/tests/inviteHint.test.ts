import { describe, expect, it } from "vitest";
import { inviteHint, inviteKind } from "../src/lib/inviteHint";

// FE-23: dòng hướng dẫn dưới mã QR phải đúng với loại địa chỉ đang chiếu.
describe("inviteHint", () => {
  it("link https (tunnel / địa chỉ công khai) dùng được mọi mạng", () => {
    expect(inviteKind("https://abc-def.trycloudflare.com/")).toBe("internet");
    expect(inviteHint("https://dinhdoclap.example.vn/")).toContain("4G");
  });

  it("địa chỉ IP nội bộ chỉ dùng được trong cùng Wi-Fi", () => {
    expect(inviteKind("http://192.168.1.20:5173/")).toBe("lan");
    expect(inviteHint("http://192.168.1.20:5173/")).toContain("cùng mạng Wi-Fi");
    expect(inviteHint("http://192.168.1.20:5173/")).not.toContain("4G");
  });
});
