import { describe, expect, it } from "vitest";
import { PLACE_PHOTOS, placePhoto } from "../src/lib/photos";

describe("ảnh của điểm", () => {
  it("ảnh quản trị viên tải lên được ưu tiên hơn ảnh có sẵn", () => {
    const p = placePhoto({ code: "001", imageUrl: "/media/places/x.jpg" });
    expect(p?.src).toContain("/media/places/x.jpg");
  });
  it("chưa tải ảnh → dùng ảnh có sẵn kèm nguồn", () => {
    const p = placePhoto({ code: "002", imageUrl: null });
    expect(p).toEqual(PLACE_PHOTOS["002"]);
    expect(p?.credit).not.toBe("");
  });
  it("điểm không có ảnh nào → null (giao diện dùng ô màu theo khu vực)", () => {
    expect(placePhoto({ code: "201", imageUrl: null })).toBeNull();
  });
});
