import { defineConfig } from "vitest/config";

// Chỉ kiểm thử phần lõi thuần TypeScript (src/core) trên Node – không cần điện thoại hay React Native.
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
