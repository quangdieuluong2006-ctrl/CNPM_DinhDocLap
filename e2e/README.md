# Kiểm thử đầu cuối (E2E)

Bốn kịch bản Playwright chạy trên hệ thống thật (PRD v2.2, mục 17.2):

| Kịch bản | Tệp | Kiểm tra |
|---|---|---|
| TC-E1 | `tests/tc-e1-nghe-tieng-anh.spec.ts` | Chọn tiếng Anh → mở `/p/201` → Nghe → tiêu đề tiếng Anh, `POST /visits` trả 201 (trigger `qr`) |
| TC-E2 | `tests/tc-e2-hai-khach-dang-hoat-dong.spec.ts` | Hai trình duyệt riêng mở Web User → Web Admin "Đang hoạt động" hiện cả hai khách |
| TC-E3 | `tests/tc-e3-sua-noi-dung.spec.ts` | Admin sửa tóm tắt tiếng Anh điểm 001 → Web User thấy nội dung mới (xong thì trả lại nội dung cũ) |
| TC-E4 | `tests/tc-e4-khoa-khach.spec.ts` | Admin khóa khách đang mở Web User → tab khách hiện thông báo bị khóa |

## Chạy trên máy

1. CSDL đã `npm run db:migrate` và `npm run db:seed` (trong `api`).
2. Chạy hệ thống: trong `api`, `npm run dev` (API :3000, Web User :5173, Web Admin :5174).
3. Ở terminal khác:
   ```bash
   cd e2e
   npm install
   npx playwright install chromium
   npm test            # hoặc npm run test:headed để xem trình duyệt chạy
   ```

Địa chỉ và tài khoản quản trị đổi được bằng biến `E2E_WEB_URL`, `E2E_ADMIN_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`
(mặc định `admin@demo.vn` / `Demo@12345` của dữ liệu mẫu). Các kịch bản dùng chung một CSDL nên chạy lần lượt (`workers: 1`).

Trên GitHub, workflow `.github/workflows/e2e.yml` tự dựng SQL Server + API + Web User + Web Admin và chạy bộ này
cho mỗi Pull Request; lỗi thì tải báo cáo ở mục Artifacts (`e2e-report`).
