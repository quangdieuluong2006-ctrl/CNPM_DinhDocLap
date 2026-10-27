import type { Server } from "socket.io";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import * as repo from "./presence.repository.js";

// Socket.IO server được gắn khi khởi động; trong test REST không có socket thì bỏ qua việc phát sự kiện.
let io: Server | undefined;
export function setPresenceIo(server: Server | undefined): void {
  io = server;
}

export interface PresenceChange {
  userId: number;
  type: "online" | "offline";
}

// Đếm lại từ v_active_users và phát presence.update tới phòng admins (PRD v1.0, mục 12).
export async function broadcastPresence(changed?: PresenceChange): Promise<void> {
  if (!io) return;
  const counts = await repo.countActiveUsers();
  io.to("admins").emit("presence.update", { ...counts, changed: changed ?? null, ts: new Date().toISOString() });
}

// Gọi sau khi một phiên đóng: chỉ báo "offline" nếu user không còn phiên nào khác đang hoạt động.
export async function afterSessionClosed(userId: number): Promise<void> {
  const stillActive = await repo.isUserActive(userId);
  await broadcastPresence({ userId, type: stillActive ? "online" : "offline" });
}

export async function runCleanupOnce(): Promise<number[]> {
  const userIds = await repo.closeStaleSessions();
  for (const userId of userIds) await afterSessionClosed(userId);
  if (userIds.length > 0) logger.info({ userIds }, "Đã đóng phiên presence mất nhịp tim");
  return userIds;
}

// Tác vụ dọn phiên chạy mỗi PRESENCE_CLEANUP_INTERVAL_SEC giây. Trả về hàm dừng.
export function startPresenceCleanup(intervalSec = env.PRESENCE_CLEANUP_INTERVAL_SEC): () => void {
  const timer = setInterval(() => {
    runCleanupOnce().catch((err: unknown) => logger.error({ err }, "Lỗi dọn phiên presence"));
  }, intervalSec * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
