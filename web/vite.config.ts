/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Web User chạy cổng 5173. Khi dev, Vite chuyển tiếp /api, /socket.io và /media (âm thanh, ảnh) sang API
// nên trình duyệt coi như cùng nguồn: cookie rt_web hoạt động, không vướng CORS.
// host: true → điện thoại cùng Wi-Fi mở được http://<IP máy>:5173 (đích của mã QR in tại phòng).
// allowedHosts: Vite mặc định chặn tên miền lạ (chống DNS rebinding); cho phép link công khai của Cloudflare Tunnel
// (cloudflared tunnel --url http://localhost:5173 → https://….trycloudflare.com) để khách dùng 4G vẫn mở được.
// Tên miền khác (tunnel có tên riêng, ngrok…) thêm qua biến ALLOWED_HOSTS trong web/.env, cách nhau bằng dấu phẩy.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const target = env.API_PROXY_TARGET || "http://localhost:3000";
  const extraHosts = (env.ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean);
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
      host: true,
      allowedHosts: [".trycloudflare.com", ...extraHosts],
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
