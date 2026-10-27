import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { io } from "socket.io-client";
import { getAccessToken, refreshSession } from "../../lib/api";
import type { PresenceUpdate } from "../../lib/types";
import { useAuth } from "../auth/AuthProvider";

const PING_INTERVAL_MS = 30_000; // nhịp tim presence (PRD v1.0, Phụ lục C)

interface RealtimeState {
  connected: boolean;
  last: PresenceUpdate | null;
}

const RealtimeContext = createContext<RealtimeState>({ connected: false, last: null });

// Một kết nối Socket.IO cho cả ứng dụng, mở sau khi đăng nhập (PRD v1.0, mục 12).
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { status, logout } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<RealtimeState>({ connected: false, last: null });

  useEffect(() => {
    if (status !== "authenticated") return;

    // auth dạng hàm: mỗi lần (kết nối lại) đều lấy access token mới nhất
    const socket = io(import.meta.env.VITE_API_BASE_URL || undefined, {
      auth: (cb) => cb({ token: getAccessToken() }),
      query: { clientType: "admin" },
      transports: ["websocket"],
    });

    socket.on("connect", () => setState((s) => ({ ...s, connected: true })));
    socket.on("disconnect", () => setState((s) => ({ ...s, connected: false })));
    socket.on("connect_error", (err: Error & { data?: { code?: string } }) => {
      const code = err.data?.code ?? err.message;
      if (code === "AUTH_TOKEN_EXPIRED") {
        // Token hết hạn: làm mới rồi để Socket.IO tự kết nối lại với token mới
        refreshSession()
          .then(() => socket.connect())
          .catch(() => void logout());
      } else if (code === "ACCOUNT_LOCKED" || code === "FORBIDDEN" || code === "AUTH_TOKEN_INVALID") {
        void logout();
      }
    });

    // Có thay đổi presence → cập nhật số ngay và tải lại danh sách/thống kê
    socket.on("presence.update", (p: PresenceUpdate) => {
      setState((s) => ({ ...s, last: p }));
      void queryClient.invalidateQueries({ queryKey: ["presence"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    });

    // Khách vừa nghe một điểm (Mobile/Web User) → Dashboard tăng "lượt tham quan hôm nay" ngay
    socket.on("admin.visit.created", () => {
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
    });
    // Nội dung vừa xuất bản phiên bản mới → tải lại danh sách điểm/ngôn ngữ
    socket.on("admin.content.published", () => {
      void queryClient.invalidateQueries({ queryKey: ["places"] });
      void queryClient.invalidateQueries({ queryKey: ["languages"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
    });

    const ping = setInterval(() => {
      if (socket.connected) socket.emit("presence.ping", {});
    }, PING_INTERVAL_MS);

    return () => {
      clearInterval(ping);
      socket.disconnect();
      setState({ connected: false, last: null });
    };
  }, [status, logout, queryClient]);

  return <RealtimeContext.Provider value={state}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeState {
  return useContext(RealtimeContext);
}
