import type { Server } from "socket.io";

// Socket.IO server dùng chung cho các module (nội dung, quản trị, khóa tài khoản) để phát sự kiện từ route REST.
// Trong test REST không mở socket thì io là undefined và các hàm phát sự kiện không làm gì.
let io: Server | undefined;

export function setHubIo(server: Server | undefined): void {
  io = server;
}

export function emitTo(room: string, event: string, data: unknown): void {
  io?.to(room).emit(event, data);
}

// Ngắt mọi kết nối của một người dùng (ví dụ khi bị khóa tài khoản).
export function disconnectUser(userId: number): void {
  io?.in(`user:${userId}`).disconnectSockets(true);
}
