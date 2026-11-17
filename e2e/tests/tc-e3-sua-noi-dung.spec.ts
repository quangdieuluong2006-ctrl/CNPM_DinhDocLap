import { expect, test } from "@playwright/test";
import { ADMIN, adminLogin, WEB } from "./env";

// TC-E3 (FE-21): Admin sửa tóm tắt tiếng Anh của điểm 001 → Web User thấy nội dung mới.
// Kịch bản tự trả lại tóm tắt cũ khi xong để chạy lại nhiều lần vẫn đúng.
test("TC-E3: Admin sửa tóm tắt điểm 001 tiếng Anh → Web User thấy nội dung mới", async ({ page, browser }) => {
  const res = await page.request.get(`${WEB}/api/v1/places/001?lang=en`);
  const place = (await res.json()) as { id: number; content: { summary: string } };
  const original = place.content.summary;
  const updated = `[E2E ${Date.now()}] ${original}`.slice(0, 300);

  await adminLogin(page);
  await page.goto(`${ADMIN}/places/${place.id}`);
  const saveSummary = async (text: string) => {
    await page.getByRole("button", { name: /English/ }).click();
    const summary = page.getByLabel("Tóm tắt");
    await summary.fill(text);
    const saved = page.waitForResponse((r) => r.url().endsWith(`/admin/places/${place.id}/contents/en`) && r.request().method() === "PUT");
    await page.getByRole("button", { name: "Lưu bài" }).click();
    expect((await saved).ok()).toBe(true);
  };

  try {
    await saveSummary(updated);
    // Một trình duyệt khách mới, ngôn ngữ tiếng Anh qua ?lang=en (giống liên kết chia sẻ)
    const ctx = await browser.newContext();
    const guest = await ctx.newPage();
    await guest.goto(`${WEB}/p/001?lang=en`);
    await expect(guest.getByText(updated)).toBeVisible();
    await ctx.close();
  } finally {
    await saveSummary(original);
  }
});
