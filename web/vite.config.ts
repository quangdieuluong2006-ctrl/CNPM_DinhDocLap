/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Web User chạy cổng 5173. Khi dev, Vite chuyển tiếp /api, /socket.io và /media (âm thanh, ảnh) sang API
// nên trình duyệt coi như cùng nguồn: cookie rt_web hoạt động, không vướng CORS.
// host: true → điện thoại cùng Wi-Fi mở được http://<IP máy>:5173 (đích của mã QR in tại phòng).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const target = env.API_PROXY_TARGET || "http://localhost:3000";
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
      host: true,
      proxy: {
        "/api": { target, changeOrigin: true },
        "/socket.io": { target, ws: true, changeOrigin: true },
        "/media": { target, changeOrigin: true },
      },
    },
    test: {
      environment: "jsdom",
      include: ["tests/**/*.test.{ts,tsx}"],
    },
  };
});
