import { describe, expect, it } from "vitest";
import { shortDay, timeAgo } from "../src/lib/format";

describe("định dạng thời gian", () => {
  const now = Date.parse("2026-10-22T07:00:00Z");
  it.each([
    ["2026-10-22T06:59:58Z", "vừa xong"],
    ["2026-10-22T06:59:48Z", "12 giây trước"],
    ["2026-10-22T06:55:00Z", "5 phút trước"],
    ["2026-10-22T04:00:00Z", "3 giờ trước"],
    ["2026-10-20T07:00:00Z", "2 ngày trước"],
  ])("%s → %s", (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected);
  });

  it("ngày dạng dd/MM", () => {
    expect(shortDay("2026-10-22")).toBe("22/10");
  });
});
