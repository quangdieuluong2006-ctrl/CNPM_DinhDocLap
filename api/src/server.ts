import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { closePool, getPool } from "./db/pool.js";
import { logger } from "./lib/logger.js";
import { closeAllOpenSessions } from "./modules/presence/presence.repository.js";
import { startPresenceCleanup } from "./modules/presence/presence.service.js";
import { initRealtime } from "./realtime/socket.js";

// HTTP + Socket.IO dùng chung một cổng; Socket.IO ở đường dẫn /socket.io.
const server = createServer(createApp());
const io = initRealtime(server);
let stopCleanup: (() => void) | undefined;

server.listen(env.PORT, () => {
  logger.info(`API đang chạy tại http://localhost:${env.PORT}`);
  getPool()
    .then(async () => {
      logger.info("Đã kết nối SQL Server");
      // Socket của lần chạy trước đã mất → đóng các phiên còn treo (NFR-19).
      const closed = await closeAllOpenSessions();
      if (closed > 0) logger.info(`Đã đóng ${closed} phiên presence còn mở từ lần chạy trước`);
      stopCleanup = startPresenceCleanup();
    })
    .catch((err: unknown) => logger.error({ err }, "Chưa kết nối được SQL Server – kiểm tra docker compose và .env"));
});

// Tắt êm: ngắt các socket, ngừng nhận request mới rồi đóng kết nối CSDL.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    logger.info(`Nhận ${signal}, đang tắt…`);
    stopCleanup?.();
    void io.close(() => {
      closePool().finally(() => process.exit(0));
    });
  });
}
