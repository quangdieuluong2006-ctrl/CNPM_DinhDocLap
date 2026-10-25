# Mobile – React Native (Expo SDK 58)

Ứng dụng thuyết minh đa ngôn ngữ theo vị trí cho khách tham quan Dinh Độc Lập (PRD v1.0, mục 4–5).

## Chạy trên điện thoại (Expo Go)

1. Điện thoại cài **Expo Go** (CH Play / App Store) – bản mới nhất (hỗ trợ SDK 58).
2. Máy tính và điện thoại **cùng một mạng Wi-Fi**. Chạy API trước: `cd api` → `npm run dev`.
3. Chạy app:
   ```
   cd mobile
   npm install
   npx expo start
   ```
4. Mở Expo Go → quét mã QR hiện trong terminal (iPhone: quét bằng Camera).

Ứng dụng tự suy ra địa chỉ API = IP Wi-Fi của máy tính + cổng 3000. Nếu không kết nối được:
- Windows hỏi cho phép Node.js qua tường lửa → chọn **Private networks** → Allow.
- Hoặc vào tab **Cài đặt → Máy chủ API** nhập `http://<IP máy tính>:3000` (xem IP bằng `ipconfig`).

Xem nhanh trên trình duyệt (không có bản đồ thật, GPS dùng chế độ mô phỏng): `npx expo start --web`.

## Thử tự động thuyết minh mà không cần đến Dinh Độc Lập

**Cài đặt → Chế độ mô phỏng vị trí** → tab **Bản đồ** có nhãn MÔ PHỎNG:
- Chạm lên bản đồ để "dịch chuyển" tới đó.
- **Chạy lộ trình mẫu**: đi từ cổng chính qua 5 điểm ngoài trời (tốc độ đi bộ ×4, nhiễu ±3 m).
  Mỗi điểm phát đúng 1 lần, đúng thứ tự; đang nghe mà đi vào vùng khác thì hiện thẻ "Bạn đang ở gần … – Nghe ngay".
- Lượt nghe ghi `trigger = simulated`, không tính vào thống kê Dashboard.

## Tài khoản (FE-01)

- Lần đầu mở: màn **Chào mừng** – "Bắt đầu tham quan" (chế độ khách, dùng đủ chức năng nghe) hoặc "Đăng nhập / Đăng ký".
- Đăng nhập (`clientType: "mobile"`): refresh token lưu trong **expo-secure-store** (Keychain/Keystore), access token chỉ trong bộ nhớ;
  hết hạn thì tự làm mới một lần (single-flight). Mở lại app vẫn đăng nhập.
- Sau khi đăng nhập app mở **Socket.IO** và gửi nhịp tim 30 giây → người dùng hiện trong "Đang hoạt động" của Web Admin;
  app xuống nền quá 60 giây thì đóng kết nối. Admin khóa tài khoản → app nhận `session.revoked`, đăng xuất và báo cho người dùng.
- Lượt nghe lúc dùng thử chưa gửi được gửi kèm tài khoản sau khi đăng nhập.
- Thử nhanh: Cài đặt → Đăng nhập `user1@demo.vn` / `Demo@12345` → mở Web Admin → **Đang hoạt động** thấy người này với nhãn Mobile.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `src/core/` | **Lõi thuần TypeScript, có test**: Haversine, `GeofenceEngine` (lọc tín hiệu, dwell 3 s, hysteresis 10 m, cooldown 10 phút, ưu tiên/gần nhất), `NarrationController` (không bao giờ phát 2 bài cùng lúc, GPS không cắt ngang), lộ trình mô phỏng, đọc mã QR |
| `src/services/` | Gọi API, lưu gói offline (expo-file-system), hàng đợi lượt ghé, nguồn vị trí thật/mô phỏng, phát âm thanh (expo-audio) và giọng tổng hợp (expo-speech) |
| `src/state/store.ts` | Nối các phần: vị trí → geofence → bộ điều phối → lượt ghé |
| `src/app/` | Màn hình (Expo Router): `language`, tab `map` · `places` · `tour` · `settings`, `place/[code]`, `player`, `scan`, deep link `p/[code]` |

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm test` | Test lõi (geofence, bộ điều phối, QR) |
| `npm run typecheck` | Kiểm tra kiểu |
| `npx expo install <gói>` | Cài thư viện đúng phiên bản SDK (không dùng `npm install <gói>`) |
