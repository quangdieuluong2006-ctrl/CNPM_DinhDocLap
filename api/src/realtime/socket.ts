import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { env } from "../config/env.js";
import { ApiError } from "../lib/apiError.js";
import { logger } from "../lib/logger.js";
import { findUserById } from "../modules/auth/auth.repository.js";
import { clientTypeSchema, type ClientType } from "../modules/auth/auth.schemas.js";
import { type Role, verifyAccessToken } from "../modules/auth/tokens.js";
import * as presenceRepo from "../modules/presence/presence.repository.js";
import { afterSessionClosed, broadcastPresence, setPresenceIo } from "../modules/presence/presence.service.js";

interface SocketData {
  userId: number;
  role: Role;
  clientType: ClientType;
  sessionId: number;
}

// Lỗi bắt tay trả về client qua connect_error: err.message = mã lỗi, err.data = { code, message }.
function handshakeError(code: string, message: string): Error {
  const err = new Error(code) as Error & { data?: unknown };
  err.data = { code, message };
  return err;
}

// Giống "trust proxy loopback" của Express: chỉ đọc X-Forwarded-For khi kết nối đến từ proxy cục bộ.
function clientIp(socket: Socket): string {
  const addr = socket.handshake.address;
  const isLoopback = addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  if (isLoopback && typeof forwarded === "string" && forwarded !== "") return forwarded.split(",")[0]!.trim();
  return addr;
}

// Khởi tạo Socket.IO trên cùng HTTP server với Express (PRD v1.0, mục 12).
export function initRealtime(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
  });

  // Xác thực khi bắt tay: io(URL, { auth: { token }, query: { clientType } })
  io.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth as { token?: unknown }).token;
      if (typeof token !== "string" || token === "") {
        next(handshakeError("AUTH_REQUIRED", "Bạn cần đăng nhập"));
        return;
      }
      const rawClient = socket.handshake.query.clientType ?? (socket.handshake.auth as { clientType?: unknown }).clientType;
      const parsedClient = clientTypeSchema.safeParse(rawClient ?? "web");
      if (!parsedClient.success) {
        next(handshakeError("VALIDATION_ERROR", "clientType phải là web, admin hoặc mobile"));
        return;
      }
      const payload = verifyAccessToken(token);
      const user = await findUserById(payload.sub);
      if (!user) {
        next(handshakeError("AUTH_TOKEN_INVALID", "Tài khoản không còn tồn tại"));
        return;
      }
      if (user.status === "locked") {
        next(handshakeError("ACCOUNT_LOCKED", "Tài khoản đã bị khóa"));
        return;
      }
      if (parsedClient.data === "admin" && user.role !== "admin") {
        next(handshakeError("FORBIDDEN", "Tài khoản không có quyền quản trị"));
        return;
      }
      const data: SocketData = { userId: user.id, role: user.role, clientType: parsedClient.data, sessionId: 0 };
      socket.data = data;
      next();
    } catch (err) {
      if (err instanceof ApiError) next(handshakeError(err.code, err.message));
      else {
        logger.error({ err }, "Lỗi xác thực Socket.IO");
        next(handshakeError("INTERNAL_ERROR", "Hệ thống đang gặp sự cố"));
      }
    }
  });

  io.on("connection", async (socket) => {
    const data = socket.data as SocketData;
    try {
      // Mỗi kết nối (tab/ứng dụng) = một dòng user_sessions.
      data.sessionId = await presenceRepo.openSession({
        userId: data.userId,
        clientType: data.clientType,
        socketId: socket.id,
        ip: clientIp(socket),
        userAgent: socket.handshake.headers["user-agent"],
      });
      await socket.join(`user:${data.userId}`);
      // Chỉ socket mở từ Web Admin mới nhận sự kiện quản trị.
      if (data.role === "admin" && data.clientType === "admin") await socket.join("admins");
      socket.emit("presence.session", { sessionId: data.sessionId });
      await broadcastPresence({ userId: data.userId, type: "online" });
    } catch (err) {
      logger.error({ err }, "Không mở được phiên presence");
      socket.disconnect(true);
      return;
    }

    // Nhịp tim tầng ứng dụng mỗi 30 giây; ack trả { ok, sessionId } nếu client truyền callback.
    socket.on("presence.ping", async (_payload: unknown, ack?: unknown) => {
      try {
        let reopened = false;
        if (!(await presenceRepo.touchSession(data.sessionId, data.userId))) {
          // Phiên đã bị dọn (ví dụ máy ngủ lâu) nhưng socket vẫn sống → mở phiên mới.
          data.sessionId = await presenceRepo.openSession({
            userId: data.userId,
            clientType: data.clientType,
            socketId: socket.id,
            ip: clientIp(socket),
            userAgent: socket.handshake.headers["user-agent"],
          });
          reopened = true;
        }
        if (typeof ack === "function") ack({ ok: true, sessionId: data.sessionId });
        if (reopened) await broadcastPresence({ userId: data.userId, type: "online" });
      } catch (err) {
        logger.error({ err }, "Lỗi xử lý presence.ping");
        if (typeof ack === "function") ack({ ok: false });
      }
    });

    socket.on("disconnect", async () => {
      try {
        await presenceRepo.closeSession(data.sessionId);
        await afterSessionClosed(data.userId);
      } catch (err) {
        logger.error({ err }, "Lỗi đóng phiên presence");
      }
    });
  });

  setPresenceIo(io);
  return io;
}
