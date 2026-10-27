import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Test dùng CSDL riêng DinhDocLapDB_test để không đụng dữ liệu dev.
// Test tích hợp (cần SQL Server) chỉ chạy khi đặt RUN_DB_TESTS=1.
export default defineConfig({
  test: {
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DB_SERVER: process.env.DB_SERVER ?? "localhost",
      DB_PORT: process.env.DB_PORT ?? "1433",
      DB_NAME: "DinhDocLapDB_test",
      DB_USER: process.env.DB_USER ?? "sa",
      DB_PASSWORD: process.env.DB_PASSWORD ?? "chua-dat-mat-khau",
      DB_TRUST_SERVER_CERTIFICATE: "true",
      JWT_ACCESS_SECRET: "test-secret-chi-dung-cho-kiem-thu-0123456789",
      LOGIN_RATE_LIMIT_MAX: "1000",
      PRESENCE_CLEANUP_INTERVAL_SEC: "30",
      // Tệp tải lên trong test ghi vào thư mục tạm; giới hạn 1 MB để kiểm tra lỗi 413.
      MEDIA_DIR: path.join(os.tmpdir(), "dinhdoclap-media-test"),
      MAX_AUDIO_MB: "1",
    },
  },
});
