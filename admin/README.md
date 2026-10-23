# Web Admin – React + Vite (TypeScript)

Trang quản trị của hệ thống thuyết minh Dinh Độc Lập (PRD v1.0, mục 7: FE-17 → FE-24).

## Chạy khi phát triển

Cần API đang chạy ở `http://localhost:3000` (xem `api/README.md`).

```bash
cd admin
npm install
npm run dev        # mở http://localhost:5174
```

Đăng nhập bằng `admin@demo.vn` / `Demo@12345` (tài khoản mẫu tạo bởi `npm run db:seed` của API).
Tài khoản không phải admin bị từ chối với thông báo "Tài khoản không có quyền quản trị".

Vite chuyển tiếp `/api`, `/socket.io` và `/media` sang API (cấu hình trong `vite.config.ts`), nên trình duyệt coi như cùng nguồn:
cookie `rt_admin` hoạt động, không cần cấu hình CORS. Đổi địa chỉ API bằng biến `API_PROXY_TARGET` trong `.env.local`.

## Các trang

| Trang | Chức năng (PRD) |
|---|---|
| Tổng quan | FE-17: 6 thẻ (đang hoạt động cập nhật realtime), lượt tham quan 7 ngày, 5 điểm nghe nhiều nhất, tỷ lệ ngôn ngữ, 10 hoạt động gần nhất |
| Đang hoạt động | FE-19: số và danh sách người dùng đang hoạt động, mã QR mời tham gia |
| Người dùng | FE-18: lọc vai trò/trạng thái/online, hoạt động gần nhất, nhóm; khóa/mở khóa, đổi vai trò, lịch sử phiên |
| Điểm thuyết minh | FE-20: bản đồ OpenStreetMap (Leaflet) + bảng; thêm/sửa điểm bằng cách bấm bản đồ, cảnh báo vùng chồng lấn, xóa (chỉ khi chưa có lượt nghe), ảnh |
| ↳ Bài theo ngôn ngữ | FE-21: soạn bài từng ngôn ngữ, Nháp → Chờ duyệt → Đã duyệt, tải/nghe thử/xóa tệp âm thanh |
| Ngôn ngữ | FE-22: thêm từ danh mục 183 ngôn ngữ ISO 639-1 có tìm kiếm, bật/tắt, mức hoàn thiện |
| Nhóm tham quan | FE-23: danh sách nhóm, hướng dẫn viên, số thành viên |
| Nhật ký hoạt động | FE-24: lọc theo nhóm hành động và ngày |
| In mã QR | FE-24: A4, 6 ô/trang (QR → `<Web User>/p/{số}`, số điểm, tên Việt + Anh) |

Mọi thay đổi nội dung tăng phiên bản gói nội dung → ứng dụng Mobile tải bản mới khi mở lại.

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy dev server cổng 5174 |
| `npm run typecheck` · `npm run lint` | Kiểm tra kiểu · kiểm tra mã |
| `npm test` | Test (Vitest + jsdom) |
| `npm run build` | Build ra `dist/` |

## Cấu trúc

```
src/
├─ lib/api.ts             # gọi API: token trong bộ nhớ, tự làm mới token (single-flight), JSON/FormData, ApiError
├─ lib/types.ts           # kiểu dữ liệu trả về từ API (xem Swagger /api/docs)
├─ features/auth/         # đăng nhập, khôi phục phiên khi tải lại trang, đăng xuất
├─ features/realtime/     # Socket.IO: presence.update, admin.visit.created, admin.content.published
├─ components/            # Layout, ui (Button, Badge, Modal…), PlacesMap (Leaflet), StatCard, InviteQrDialog
└─ pages/                 # mỗi trang một tệp (bảng ở trên)
```
