/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Web Admin chạy cổng 5174 (Web User dùng 5173). Khi dev, Vite chuyển tiếp /api và /socket.io
// (và /media – tệp âm thanh, ảnh) sang API nên trình duyệt coi như cùng nguồn: cookie rt_admin hoạt động, không vướng CORS.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const target = env.API_PROXY_TARGET || "http://localhost:3000";
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5174,
      strictPort: true,
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
