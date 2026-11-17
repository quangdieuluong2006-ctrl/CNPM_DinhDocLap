import { expect, type Page } from "@playwright/test";

// Địa chỉ ba phần của hệ thống; CI hoặc máy khác có thể đổi qua biến môi trường.
export const WEB = process.env.E2E_WEB_URL ?? "http://localhost:5173";
export const ADMIN = process.env.E2E_ADMIN_URL ?? "http://localhost:5174";
// Quản trị viên mẫu do `npm run db:seed` tạo (mật khẩu = SEED_PASSWORD, mặc định Demo@12345).
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@demo.vn";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Demo@12345";

// Đăng nhập Web Admin qua giao diện, chờ vào được Dashboard.
export async function adminLogin(page: Page): Promise<void> {
  await page.goto(`${ADMIN}/login`);
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/);
}

// Mở Web User và chờ API tạo xong khách ẩn danh; trả về khách đó (id, tên "Khách #…").
export async function openAsGuest(page: Page, path = "/"): Promise<{ id: number; fullName: string }> {
  const guest = page.waitForResponse((r) => r.url().includes("/api/v1/auth/guest") && r.status() === 201);
  await page.goto(`${WEB}${path}`);
  const body = (await (await guest).json()) as { user: { id: number; fullName: string } };
  return body.user;
}
