import type { Server } from "socket.io";

// Socket.IO server dùng chung cho các module (nhóm, nội dung, quản trị) để phát sự kiện từ route REST.
// Trong test REST không mở socket thì io là undefined và các hàm phát sự kiện không làm gì.
let io: Server | undefined;

export function setHubIo(server: Server | undefined): void {
  io = server;
}

export function emitTo(room: string, event: string, data: unknown): void {
  io?.to(room).emit(event, data);
}

// Cho mọi socket của một người dùng vào/ra một phòng (ví dụ tour:{id}) ngay khi họ tham gia/rời nhóm qua REST.
export function userJoinRoom(userId: number, room: string): void {
  io?.in(`user:${userId}`).socketsJoin(room);
}

export function userLeaveRoom(userId: number, room: string): void {
  io?.in(`user:${userId}`).socketsLeave(room);
}

export function roomLeaveAll(room: string): void {
  io?.in(room).socketsLeave(room);
}

// Ngắt mọi kết nối của một người dùng (ví dụ khi bị khóa tài khoản).
export function disconnectUser(userId: number): void {
  io?.in(`user:${userId}`).disconnectSockets(true);
}

export async function isUserConnected(userId: number): Promise<boolean> {
  if (!io) return false;
  return (await io.in(`user:${userId}`).fetchSockets()).length > 0;
}
