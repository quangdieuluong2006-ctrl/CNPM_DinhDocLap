# Web User – React + Vite (TypeScript)

Trang web cho khách tham quan Dinh Độc Lập (PRD v1.0, mục 6: FE-13 → FE-16). Đây cũng là trang mở ra khi khách
quét mã QR tại phòng bằng camera điện thoại mà chưa cài ứng dụng: `https://<web-user>/p/201`.

## Chạy khi phát triển

Cần API đang chạy ở `http://localhost:3000` (xem `api/README.md`).

```bash
cd web
npm install
npm run dev        # mở http://localhost:5173
```

Điện thoại cùng Wi-Fi mở được `http://<IP máy tính>:5173` (Vite chạy với `host: true`; Windows hỏi tường lửa thì chọn Allow).
Vite chuyển tiếp `/api`, `/socket.io`, `/media` sang API nên không cần cấu hình CORS.

## Trang

| Route | Trang |
|---|---|
| `/` | Trang chủ: giới thiệu, chọn ngôn ngữ thuyết minh, danh sách điểm theo khu vực |
| `/places?zone=&q=` | Danh sách điểm: tìm theo tên/số điểm (không dấu), lọc khu vực; tham số nằm trên URL để chia sẻ |
| `/map` | Bản đồ khuôn viên (Leaflet + OpenStreetMap): vùng tự phát của điểm ngoài trời, marker 🏛 gộp các phòng trong nhà, vị trí của bạn (không gửi lên máy chủ) |
| `/login`, `/register` | Đăng nhập, đăng ký (giao diện chia đôi, hiện/ẩn mật khẩu) |
| `/tour` | Mục **Nhóm** trên menu: nhập mã nhóm 6 ký tự; hướng dẫn viên / quản trị viên tạo nhóm mới và nhận mã |
| `/tour/:code` | Tham gia nhóm tham quan (đích của mã nhóm hướng dẫn viên chia sẻ): thành viên, ai đang nghe điểm nào – cập nhật realtime; hướng dẫn viên thấy đường dẫn chia sẻ và nút **Kết thúc nhóm** |
| `/me` | Tài khoản: thông tin, lịch sử các điểm đã nghe (cần đăng nhập) |
| `/p/:code` | Chi tiết điểm + nghe thuyết minh (đích của mã QR). Có tệp âm thanh → thẻ `<audio>`; không có → giọng đọc của trình duyệt (Web Speech API) |

Ngôn ngữ thuyết minh chọn bằng nút 🎧 (nhớ trong trình duyệt, hoặc truyền `?lang=ja` trên liên kết); ngôn ngữ giao diện đổi bằng nút VI/EN.
Đã đăng nhập: mở một kết nối Socket.IO (`clientType: "web"`) và gửi nhịp tim 30 giây → người dùng hiện trong
"Đang hoạt động" của Web Admin; bị admin khóa thì tự đăng xuất (`session.revoked`).

Mỗi lần nghe ghi một lượt ghé (`POST /visits`): mở từ danh sách → `manual`, mở thẳng liên kết QR → `qr`.

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy dev server cổng 5173 |
| `npm run typecheck` · `npm run lint` | Kiểm tra kiểu · kiểm tra mã |
| `npm test` | Test (Vitest) |
| `npm run build` | Build ra `dist/` |
