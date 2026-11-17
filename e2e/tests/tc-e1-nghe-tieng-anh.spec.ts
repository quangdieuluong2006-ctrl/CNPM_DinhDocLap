import { expect, test } from "@playwright/test";
import { openAsGuest, WEB } from "./env";

// TC-E1 (FE-13, FE-14): khách mở Web User → chọn tiếng Anh → mở /p/201 (đích của mã QR) → bấm Nghe
// → tiêu đề hiện bằng tiếng Anh, lượt nghe được ghi (POST /visits trả 201).
test("TC-E1: chọn tiếng Anh, mở /p/201, nghe → tiêu đề tiếng Anh và ghi lượt nghe", async ({ page }) => {
  await openAsGuest(page);

  // Chọn ngôn ngữ thuyết minh ở thanh trên cùng; giao diện đổi theo (nút đổi tiêu đề sang tiếng Anh)
  await page.getByTitle("Ngôn ngữ thuyết minh").click();
  await page.getByRole("button", { name: /English/ }).click();
  await expect(page.getByTitle("Narration language")).toBeVisible();

  // Tiêu đề tiếng Anh mong đợi lấy thẳng từ API công khai (qua proxy của Web User)
  const res = await page.request.get(`${WEB}/api/v1/places/201?lang=en`);
  const place = (await res.json()) as { id: number; content: { title: string; lang: string } };
  expect(place.content.lang).toBe("en");

  await page.goto(`${WEB}/p/201`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(place.content.title);

  // Bấm Nghe rồi rời trang: lượt nghe được ghi khi kết thúc, dừng hoặc rời trang
  await page.getByRole("button", { name: "Listen" }).click();
  await page.waitForTimeout(1500);
  const visit = page.waitForRequest((r) => r.url().endsWith("/api/v1/visits") && r.method() === "POST");
  const visitRes = page.waitForResponse((r) => r.url().endsWith("/api/v1/visits") && r.request().method() === "POST");
  await page.getByRole("link", { name: "Places" }).first().click();

  const sent = (await visit).postDataJSON() as { placeId: number; lang: string; trigger: string };
  expect(sent).toMatchObject({ placeId: place.id, lang: "en", trigger: "qr" }); // mở thẳng liên kết /p/201 = quét QR
  expect((await visitRes).status()).toBe(201);
});
