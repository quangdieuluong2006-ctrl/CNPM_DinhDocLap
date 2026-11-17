import { defineConfig, devices } from "@playwright/test";

// Kiểm thử đầu cuối TC-E1 → TC-E4 (PRD v2.2, mục 17.2) trên hệ thống đang chạy thật:
// API (:3000) + Web User (:5173) + Web Admin (:5174) + SQL Server đã migrate và seed.
// Chạy trên máy: mở `npm run dev` trong thư mục api (hoặc CI tự khởi động), rồi `npm test` trong thư mục e2e.
export default defineConfig({
  testDir: "./tests",
  // Các kịch bản dùng chung một CSDL (sửa bài, khóa khách) nên chạy lần lượt, không song song.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    locale: "vi-VN",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
