import { expect, test } from "@playwright/test";
import { ADMIN, adminLogin, openAsGuest } from "./env";

// TC-E4 (FE-18): Admin khóa một khách đang mở Web User → tab của khách hiện thông báo bị khóa ngay
// (máy chủ phát session.revoked qua Socket.IO rồi ngắt kết nối).
test("TC-E4: Admin khóa khách đang trực tuyến → tab khách hiện thông báo bị khóa", async ({ browser, page }) => {
  const ctx = await browser.newContext();
  try {
    const guestPage = await ctx.newPage();
    const guest = await openAsGuest(guestPage);

    await adminLogin(page);
    await page.goto(`${ADMIN}/users`);
    await page.getByPlaceholder(/Tìm theo tên/).fill(guest.fullName);
    await page.getByRole("cell", { name: new RegExp(guest.fullName) }).click();
    await page.getByPlaceholder("Ví dụ: Spam nội dung").fill("Kiểm thử E2E");
    await page.getByRole("button", { name: "Khóa tài khoản" }).click();

    await expect(guestPage.getByRole("alert")).toContainText("bị quản trị viên khóa");
  } finally {
    await ctx.close();
  }
});
