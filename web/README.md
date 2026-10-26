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

## Cho khách ngoài mạng Wi-Fi (Cloudflare Tunnel)

Link `http://<IP máy>:5173` chỉ mở được khi điện thoại **cùng Wi-Fi**. Muốn khách dùng 4G vẫn quét QR vào được (laptop vẫn phải bật):

1. Cài một lần: `winget install --id Cloudflare.cloudflared`.
2. **Cách nhanh:** `cd api` → `npm run dev` – chạy luôn API, Web User, Web Admin và tunnel, mã QR tự dùng link công khai
   (xem `api/README.md`). Các bước dưới đây là cách làm tay.
3. Chạy API và Web User như bình thường, rồi mở terminal mới: `cloudflared tunnel --url http://localhost:5173`
   → in ra địa chỉ dạng `https://ten-ngau-nhien.trycloudflare.com`. Vite đã cho phép tên miền `*.trycloudflare.com` (`vite.config.ts`).
4. Đặt `WEB_USER_PUBLIC_URL=<địa chỉ đó>` trong `api/.env`, khởi động lại API → mã QR "Mời tham gia" trên Web Admin dùng địa chỉ công khai.

Chỉ cần tunnel cổng 5173: Vite chuyển tiếp `/api`, `/socket.io`, `/media` sang API nên khách không truy cập thẳng cổng 3000.
Quick tunnel miễn phí, không cần tài khoản nhưng **đổi địa chỉ mỗi lần chạy** – chỉ dùng để demo; chạy thật thì triển khai lên máy chủ.

## Trang

**Không đăng nhập / đăng ký:** khách quét QR là dùng ngay. Lần đầu mở, web gọi `POST /auth/guest` để API tạo một
*khách ẩn danh* (`Khách #A1B2`) cho trình duyệt này; các lần sau chỉ khôi phục phiên từ cookie `rt_web`. Nhờ đó lượt nghe
vẫn vào lịch sử và khách hiện trong "Đang hoạt động" của Web Admin. Liên kết cũ `/login`, `/register`, `/tour` chuyển về trang chủ.

| Route | Trang |
|---|---|
| `/` | Trang chủ: giới thiệu, chọn ngôn ngữ thuyết minh, danh sách điểm theo khu vực |
| `/places?zone=&q=` | Danh sách điểm: tìm theo tên/số điểm (không dấu), lọc khu vực; tham số nằm trên URL để chia sẻ |
| `/map` | Bản đồ khuôn viên (Leaflet + OpenStreetMap): vùng tự phát của điểm ngoài trời, marker 🏛 gộp các phòng trong nhà, vị trí của bạn (không gửi lên máy chủ) |
| `/me` | Lịch sử các điểm đã nghe trên trình duyệt này (nút đồng hồ trên menu) |
| `/p/:code` | Chi tiết điểm + nghe thuyết minh (đích của mã QR). Có tệp âm thanh → thẻ `<audio>`; không có → giọng đọc của trình duyệt (Web Speech API) |

Ngôn ngữ thuyết minh chọn bằng nút 🎧 (nhớ trong trình duyệt, hoặc truyền `?lang=ja` trên liên kết). **Giao diện đổi theo ngôn ngữ thuyết minh**
– đủ 10 ngôn ngữ (vi, en, zh, ko, ja, fr, de, ru, es, th), để khách không biết tiếng Anh vẫn hiểu các nút bấm. Ngôn ngữ thuyết minh
mới chưa có bản dịch giao diện → giao diện tiếng Anh. Bản dịch nằm ở `src/lib/i18n.ts` (vi, en) và `src/lib/locales/` (8 ngôn ngữ còn lại);
test `tests/i18n-locales.test.ts` báo lỗi nếu một ngôn ngữ thiếu câu. Bản dịch tiếng Thái và tiếng Nga cần người bản ngữ xem lại.
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
