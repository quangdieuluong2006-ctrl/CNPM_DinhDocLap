# Mobile – React Native (Expo SDK 58)

Ứng dụng thuyết minh đa ngôn ngữ theo vị trí cho khách tham quan Dinh Độc Lập (PRD v1.0, mục 4–5).

**Ngôn ngữ giao diện đi theo ngôn ngữ thuyết minh** – đủ 10 ngôn ngữ (vi, en, zh, ko, ja, fr, de, ru, es, th); chưa chọn thì theo
ngôn ngữ của điện thoại, ngôn ngữ chưa có bản dịch giao diện thì dùng tiếng Anh. Bản dịch: `src/i18n.ts` (vi, en) và `src/locales/`;
test `tests/i18n.test.ts` báo lỗi nếu một ngôn ngữ thiếu câu. Bản dịch tiếng Thái và tiếng Nga cần người bản ngữ xem lại.

Ảnh 5 điểm ngoài trời có sẵn trong `assets/places/` (nguồn ở `assets/places/CREDITS.md`, chỉ dùng cho mục đích học tập);
ảnh quản trị viên tải lên ở Web Admin luôn được ưu tiên, điểm chưa có ảnh hiện ô màu theo khu vực. Hiệu ứng động dùng
`Animated` có sẵn của React Native (`src/components/ui.tsx`: `FadeIn`, `Equalizer`, `PulseRing`), không thêm thư viện.

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

## Khách dùng ngay – không đăng nhập / đăng ký

- Lần đầu mở: màn **Chào mừng** chỉ có nút "Bắt đầu tham quan". App gọi `POST /auth/guest` (`clientType: "mobile"`) để API tạo
  một *khách ẩn danh* (`Khách #A1B2`) cho máy này; refresh token lưu trong **expo-secure-store** (Keychain/Keystore), access token
  chỉ trong bộ nhớ, hết hạn tự làm mới (single-flight). Mở app lúc mất mạng → tạo khách khi có mạng trở lại.
- Có phiên khách, app mở **Socket.IO** và gửi nhịp tim 30 giây → khách hiện trong "Đang hoạt động" của Web Admin (nhãn Khách · Mobile);
  app xuống nền quá 60 giây thì đóng kết nối. Phiên hết hạn → lặng lẽ tạo khách mới; Admin khóa khách → app báo, vẫn nghe được nội dung.
- Thử nhanh: mở app → **Bắt đầu tham quan** → mở Web Admin → **Đang hoạt động** thấy "Khách #…" với nhãn Mobile.
- Nhóm tham quan đã bỏ khỏi giao diện (giảng viên không yêu cầu); API `/tours` vẫn giữ để có thể bật lại.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `src/core/` | **Lõi thuần TypeScript, có test**: Haversine, `GeofenceEngine` (lọc tín hiệu, dwell 3 s, hysteresis 10 m, cooldown 10 phút, ưu tiên/gần nhất), `NarrationController` (không bao giờ phát 2 bài cùng lúc, GPS không cắt ngang), lộ trình mô phỏng, đọc mã QR |
| `src/services/` | Gọi API, lưu gói offline (expo-file-system), hàng đợi lượt ghé, nguồn vị trí thật/mô phỏng, phát âm thanh (expo-audio) và giọng tổng hợp (expo-speech) |
| `src/state/store.ts` | Nối các phần: vị trí → geofence → bộ điều phối → lượt ghé |
| `src/app/` | Màn hình (Expo Router): `language`, tab `map` · `places` · `settings`, `place/[code]`, `player`, `scan`, deep link `p/[code]` |

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm test` | Test lõi (geofence, bộ điều phối, QR) |
| `npm run typecheck` | Kiểm tra kiểu |
| `npx expo install <gói>` | Cài thư viện đúng phiên bản SDK (không dùng `npm install <gói>`) |
