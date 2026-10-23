# Thuyết minh đa ngôn ngữ theo vị trí – Dinh Độc Lập

Đồ án Công nghệ phần mềm – đề tài **FE DEV (React Native + React.js), xử lý giao diện Web và Mobile, kèm CI/CD**.

Ứng dụng thuyết minh du lịch chạy trên điện thoại của khách: tự động phát bài thuyết minh khi khách đến gần một điểm
ngoài trời (GPS), quét mã QR hoặc nhập số điểm ở các phòng trong nhà, chọn ngôn ngữ thuyết minh, dùng được khi mất mạng,
tham quan theo nhóm. Ban quản lý cập nhật điểm, tọa độ, nội dung đa ngôn ngữ và tệp âm thanh trên Web Admin.

## Tài liệu

- **PRD v1.0** (căn cứ triển khai): [`docs/PRD_Thuyet_Minh_Dinh_Doc_Lap_v1.0.pdf`](docs/PRD_Thuyet_Minh_Dinh_Doc_Lap_v1.0.pdf)
  · bản Word: [`docs/PRD_Thuyet_Minh_Dinh_Doc_Lap_v1.0.docx`](docs/PRD_Thuyet_Minh_Dinh_Doc_Lap_v1.0.docx)
- Sơ đồ UML (nguồn PlantUML): [`docs/diagrams/`](docs/diagrams/)

## Thành phần

| Thư mục | Thành phần | Công nghệ |
|---|---|---|
| `mobile/` | Ứng dụng của khách (phần quan trọng nhất) | React Native, Expo SDK 58, TypeScript (xem `mobile/README.md`) |
| `web/` | Web User: xem điểm, nghe thuyết minh | React 19, Vite, TypeScript |
| `admin/` | Web Admin: nội dung, người dùng, thống kê | React 19, Vite, TypeScript |
| `api/` | Backend REST + Socket.IO | Node.js 22, Express 5, TypeScript |
| `db/` | Cơ sở dữ liệu | SQL Server 2022 |

## Quy trình làm việc

- Nhánh `main` (ổn định) ← `develop` (tích hợp) ← `feature/FE-xx-...`.
- Mỗi tính năng một Pull Request vào `develop`, CI phải xanh và có người review Approve.
- Commit theo Conventional Commits: `feat(mobile): …`, `fix(api): …`, `docs(prd): …`.

> Repo trước của nhóm (chủ đề thuyết minh video, đã chuyển hướng): https://github.com/quangdieuluong2006-ctrl/CNPM
