import { expect, test } from "@playwright/test";
import { ADMIN, adminLogin, openAsGuest } from "./env";

// TC-E2 (FE-19): hai trình duyệt riêng (hai context = hai bộ cookie) mở Web User → hai khách ẩn danh;
// Web Admin trang "Đang hoạt động" hiện cả hai.
test("TC-E2: hai khách mở Web User → Admin thấy cả hai đang hoạt động", async ({ browser, page }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  try {
    const guestA = await openAsGuest(await ctxA.newPage());
    const guestB = await openAsGuest(await ctxB.newPage());
    expect(guestA.id).not.toBe(guestB.id);

    await adminLogin(page);
    await page.goto(`${ADMIN}/active-users`);
    // Danh sách cập nhật theo Socket.IO (presence.update); expect tự chờ tới khi khách hiện ra.
    // Ô "Họ tên" còn có nhãn loại khách bên cạnh tên nên tìm theo hàng có chứa tên, không đòi khớp cả ô.
    await expect(page.getByRole("row", { name: new RegExp(guestA.fullName) })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(guestB.fullName) })).toBeVisible();
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
