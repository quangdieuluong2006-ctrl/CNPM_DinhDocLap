import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { API_ROOT, getAccessToken, refreshSession } from "../lib/api";
import { useAuth } from "./auth";

const PING_INTERVAL_MS = 30_000; // nhịp tim presence (PRD v1.0, Phụ lục C)

interface RealtimeValue {
  socket: Socket | null;
  connected: boolean;
}

const RealtimeContext = createContext<RealtimeValue>({ socket: null, connected: false });

// Một kết nối Socket.IO sau khi đăng nhập (clientType "web"): máy chủ ghi user_sessions → người dùng hiện
// trong "Đang hoạt động" của Web Admin; gửi presence.ping mỗi 30 giây (PRD v1.0, mục 4.7, 12).
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { status, logout } = useAuth();
  const [value, setValue] = useState<RealtimeValue>({ socket: null, connected: false });

  useEffect(() => {
    if (status !== "authenticated") return;
    // auth dạng hàm: mỗi lần (kết nối lại) đều lấy access token mới nhất
    const socket = io(API_ROOT || undefined, {
      auth: (cb) => cb({ token: getAccessToken() }),
      query: { clientType: "web" },
      transports: ["websocket"],
    });
    setValue({ socket, connected: false });

    socket.on("connect", () => setValue({ socket, connected: true }));
    socket.on("disconnect", () => setValue({ socket, connected: false }));
    socket.on("connect_error", (err: Error & { data?: { code?: string } }) => {
      const code = err.data?.code ?? err.message;
      if (code === "AUTH_TOKEN_EXPIRED") {
        refreshSession()
          .then(() => socket.connect())
          .catch(() => void logout());
      } else if (code === "ACCOUNT_LOCKED" || code === "AUTH_TOKEN_INVALID") {
        void logout();
      }
    });
    // Admin khóa tài khoản → đăng xuất ngay
    socket.on("session.revoked", () => void logout());

    const ping = setInterval(() => {
      if (socket.connected) socket.emit("presence.ping", {});
    }, PING_INTERVAL_MS);

    return () => {
      clearInterval(ping);
      socket.disconnect();
      setValue({ socket: null, connected: false });
    };
  }, [status, logout]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeValue {
  return useContext(RealtimeContext);
}
