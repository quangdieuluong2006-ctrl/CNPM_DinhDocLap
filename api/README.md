# API – Backend Node.js + SQL Server

Backend của ứng dụng thuyết minh đa ngôn ngữ theo vị trí – Dinh Độc Lập (PRD v1.0, mục 11–13).
Express 5 + TypeScript, Socket.IO (realtime), SQL Server 2022 (node-mssql), tài liệu Swagger.

## Chạy lần đầu (Windows, SQL Server đã cài sẵn)

1. SQL Server: bật đăng nhập `sa` (SQL Server and Windows Authentication mode) và TCP/IP cổng 1433
   (SQL Server Configuration Manager → Protocols for MSSQLSERVER → TCP/IP → Enable, IPAll → TCP Port 1433), rồi Restart dịch vụ.
   Máy chưa có SQL Server: `copy .env.example .env` ở thư mục gốc rồi `docker compose up -d sqlserver`.
2. API:

```bash
cd api
copy .env.example .env      # sửa DB_PASSWORD cho đúng mật khẩu sa
npm install
npm run db:migrate          # tạo CSDL DinhDocLapDB và chạy db/migrations/*.sql
npm run db:seed             # 10 ngôn ngữ, 9 tài khoản, 12 điểm Dinh Độc Lập × 10 ngôn ngữ, lượt ghé mẫu
npm run dev                 # http://localhost:3000
```

Tài khoản mẫu (mật khẩu `Demo@12345`): `admin@demo.vn` (admin), `guide1@demo.vn`, `guide2@demo.vn` (hướng dẫn viên),
`user1@demo.vn` … `user6@demo.vn`.

PowerShell báo "running scripts is disabled": chạy một lần `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy API, tự tải lại khi sửa code |
| `npm run db:migrate` · `npm run db:seed` | Chạy migration chưa chạy · nạp dữ liệu mẫu (chạy lại an toàn) |
| `npm run typecheck` · `npm run lint` | Kiểm tra kiểu · kiểm tra mã |
| `npm test` | Test đơn vị |
| `RUN_DB_TESTS=1 npm test` | Thêm test tích hợp trên SQL Server (CSDL riêng `DinhDocLapDB_test`) |
| `npm run build` · `npm start` | Build ra `dist/` · chạy bản build |

## Tài liệu API (Swagger)

Mở **http://localhost:3000/api/docs**: `POST /api/v1/auth/login` → Try it out → sao chép `accessToken` → **Authorize** → gọi các API cần đăng nhập.
Thêm/sửa route thì cập nhật `src/docs/openapi.ts` (hoặc `openapi.content.ts`); test `tests/openapi.test.ts` báo lỗi nếu tài liệu lệch với route thật.

## Các nhóm API (`/api/v1`)

| Nhóm | Endpoint chính | Quyền |
|---|---|---|
| Nội dung | `GET /languages`, `GET /places?lang=&zone=&q=`, `GET /places/{code}?lang=`, `GET /content/bundle?lang=` (ETag → 304), `GET /content/version` | Công khai |
| Lượt ghé | `POST /visits`, `POST /visits/batch` (bỏ trùng theo `clientId`), `GET /me/visits` | Khách / đăng nhập |
| Nhóm tham quan | `POST /tours`, `GET /me/tour`, `GET /tours/{code}`, `POST /tours/{code}/join`, `POST /tours/{id}/leave`, `GET /tours/{id}/members`, `POST /tours/{id}/end` | Đăng nhập; tạo nhóm: guide/admin |
| Quản trị nội dung | `/admin/places` (CRUD), `PUT /admin/places/{id}/contents/{lang}`, `POST …/audio` (multipart), `POST /admin/places/{id}/image`, `/admin/languages` + `/catalog` | admin |
| Quản trị người dùng | `/admin/users` (lọc, khóa/mở, đổi vai trò), `/admin/tours`, `/admin/activity-logs`, `/admin/stats`, `/admin/presence` | admin |

- Bài hiển thị cho khách: `approved` và `pending` (kèm nhãn); `draft` ẩn. Thiếu bài ngôn ngữ đã chọn → dự phòng `en` → `vi` (`isFallback: true`).
- Mọi thay đổi ở API quản trị nội dung tăng phiên bản (`content_releases`) → ETag gói offline đổi → ứng dụng tải lại.
- Tệp tải lên lưu ở `MEDIA_DIR` (mặc định `storage/media`, đã gitignore), phục vụ tại `/media/...` có hỗ trợ HTTP Range.

## Cơ sở dữ liệu

- Migration: `db/migrations/00X_mo_ta.sql`, tách khối bằng `GO`, mỗi tệp chạy trong một transaction và được ghi vào `schema_migrations`.
  **Không sửa** migration đã merge – thay đổi mới viết thành tệp mới. Giữ `SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON;` đầu tệp.
- Dữ liệu mẫu: `db/seed/places.vi-en.json` (bài tiếng Việt/Anh, đã duyệt) và `db/seed/places.i18n.json` (8 ngôn ngữ, chờ duyệt).
  **Nội dung lịch sử và tọa độ là bản nháp – phải đối chiếu nguồn chính thức (PRD mục 18.4).**
- Thời gian lưu UTC; "hôm nay" trên Dashboard tính theo giờ Việt Nam.

```sql
USE DinhDocLapDB;
SELECT * FROM dbo.v_active_users;          -- người dùng đang hoạt động
SELECT * FROM dbo.v_language_completeness; -- mức hoàn thiện nội dung theo ngôn ngữ
EXEC dbo.sp_admin_dashboard_stats;         -- 6 số liệu Dashboard
```

## Người dùng đang hoạt động (presence)

Mỗi kết nối Socket.IO ghi một dòng `user_sessions`; client gửi `presence.ping` mỗi 30 giây; "đang hoạt động" = phiên chưa đóng và
nhịp tim trong 60 giây; đếm `DISTINCT user_id` (view `v_active_users`); mất mạng → tác vụ dọn phiên đóng sau 60 giây; mỗi thay đổi
phát `presence.update` tới phòng `admins`.
