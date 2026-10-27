# Thuyết minh đa ngôn ngữ theo vị trí – Dinh Độc Lập

Đồ án Công nghệ phần mềm – đề tài **FE DEV (React Native + React.js), xử lý giao diện Web và Mobile, kèm CI/CD**.

Ứng dụng thuyết minh du lịch chạy trên điện thoại của khách: tự động phát bài thuyết minh khi khách đến gần một điểm
ngoài trời (GPS), quét mã QR hoặc nhập số điểm ở các phòng trong nhà, chọn ngôn ngữ thuyết minh, dùng được khi mất mạng.
Khách **không cần đăng ký hay đăng nhập**: quét mã QR là dùng ngay. Ban quản lý cập nhật điểm, tọa độ, nội dung đa ngôn ngữ
và tệp âm thanh trên Web Admin.

## Tính năng chính

- **Khách ẩn danh**: lần đầu mở Web User hoặc app, hệ thống tự tạo một "khách" (`Khách #XXXX`) cho trình duyệt / điện thoại đó,
  để lưu lịch sử các điểm đã nghe và hiển thị trong mục "Đang hoạt động" của Web Admin.
- **10 ngôn ngữ**: Việt, Anh, Trung, Hàn, Nhật, Pháp, Đức, Nga, Tây Ban Nha, Thái. Đổi ngôn ngữ thuyết minh thì toàn bộ
  giao diện Web User và Mobile cũng đổi theo (ngôn ngữ chưa có bản dịch giao diện dùng tiếng Anh).
- **Mobile**: tự phát thuyết minh theo vị trí (geofence), bản đồ, quét QR, trình phát (tốc độ, nghe lại), gói dữ liệu offline.
- **Web User**: danh sách điểm, bản đồ, trình phát, lịch sử các điểm đã nghe.
- **Web Admin**: thống kê, quản lý điểm và nội dung đa ngôn ngữ, ảnh/âm thanh, người dùng, nhật ký hoạt động,
  khách đang hoạt động (realtime), mã QR "Mời tham gia" và in mã QR cho từng phòng.

## Chạy demo nhanh

Lần đầu: cài thư viện (`npm install`) trong `api`, `web`, `admin` và chuẩn bị CSDL theo [`api/README.md`](api/README.md).
Các lần sau chỉ cần:

```bash
cd api
npm run demo
```

Lệnh này chạy API (:3000), Web User (:5173), Web Admin (:5174) và Cloudflare Tunnel (link `https://….trycloudflare.com`
để khách dùng 4G vẫn quét QR được), rồi tự mở Web Admin và các tab khách ảo. **Ctrl + C** tắt tất cả.
Chi tiết: [`api/README.md`](api/README.md). App Mobile chạy riêng: xem [`mobile/README.md`](mobile/README.md).

## Tài liệu

- **PRD v1.0** (căn cứ triển khai): [`docs/PRD_Thuyet_Minh_Dinh_Doc_Lap_v1.0.pdf`](docs/PRD_Thuyet_Minh_Dinh_Doc_Lap_v1.0.pdf)
  · bản Word: [`docs/PRD_Thuyet_Minh_Dinh_Doc_Lap_v1.0.docx`](docs/PRD_Thuyet_Minh_Dinh_Doc_Lap_v1.0.docx)
- Sơ đồ UML (nguồn PlantUML): [`docs/diagrams/`](docs/diagrams/)

### Thay đổi so với PRD v1.0 (sẽ cập nhật vào PRD v1.1)

| Nội dung | Trước đây | Hiện tại | Lý do |
|---|---|---|---|
| Tài khoản của khách | Đăng ký / đăng nhập | Khách ẩn danh, quét QR là dùng | Khách du lịch thường chỉ đến một lần, bắt đăng ký gây phiền |
| Tham quan theo nhóm | Có | Bỏ | Giảng viên không yêu cầu |
| Ngôn ngữ giao diện | Tiếng Việt / tiếng Anh | Theo ngôn ngữ thuyết minh (10 ngôn ngữ) | Khách không biết tiếng Anh vẫn dùng được |
| Truy cập khi demo | Cùng mạng Wi-Fi | Thêm Cloudflare Tunnel | Khách dùng 4G vẫn quét QR được |

## Thành phần

| Thư mục | Thành phần | Công nghệ |
|---|---|---|
| `mobile/` | Ứng dụng của khách (phần quan trọng nhất) | React Native, Expo SDK 58, TypeScript (xem `mobile/README.md`) |
| `web/` | Web User: xem điểm, nghe thuyết minh | React 19, Vite, TypeScript |
| `admin/` | Web Admin: nội dung, người dùng, thống kê | React 19, Vite, TypeScript |
| `api/` | Backend REST + Socket.IO | Node.js 22, Express 5, TypeScript |
| `db/` | Cơ sở dữ liệu | SQL Server 2022 |

## CI/CD

GitHub Actions có 4 workflow trong [`.github/workflows/`](.github/workflows/), chạy khi push hoặc tạo Pull Request vào `develop` / `main`:

| Workflow | Kiểm tra |
|---|---|
| `ci-api.yml` | Typecheck, lint, test (gồm test tích hợp với SQL Server), build |
| `ci-web.yml` | Typecheck, lint, test, build |
| `ci-admin.yml` | Typecheck, lint, test, build |
| `ci-mobile.yml` | Typecheck, test, `expo export` (bản web) |

Chạy thử trên máy trước khi tạo PR (trong từng thư mục): `npm run typecheck`, `npm run lint`, `npm test`
(Mobile không có `lint`).

## Quy trình làm việc

- Nhánh `main` (ổn định) ← `develop` (tích hợp) ← `feature/...`, `fix/...`, `docs/...`.
- Mỗi thay đổi một Pull Request vào `develop`, CI phải xanh và có người review Approve.
- Commit theo Conventional Commits: `feat(mobile): …`, `fix(api): …`, `docs(prd): …`.

> Repo trước của nhóm (chủ đề thuyết minh video, đã chuyển hướng): https://github.com/quangdieuluong2006-ctrl/CNPM
