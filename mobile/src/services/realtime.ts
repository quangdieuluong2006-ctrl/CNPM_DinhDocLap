import { AppState, type AppStateStatus, type NativeEventSubscription } from "react-native";
import { io, type Socket } from "socket.io-client";

const PING_INTERVAL_MS = 30_000; // nhịp tim presence (PRD v1.0, Phụ lục C)
const BACKGROUND_CLOSE_MS = 60_000; // xuống nền quá 60 giây thì đóng kết nối (PRD v1.0, mục 12)

export interface RealtimeHandlers {
  getToken(): string | null;
  onTokenExpired(): Promise<boolean>; // làm mới access token; false = phiên hết hạn
  onRevoked(reason: string): void; // bị khóa tài khoản / phiên bị thu hồi → đăng xuất
  onStatus(connected: boolean): void;
}

// Một kết nối Socket.IO sau khi đăng nhập (clientType "mobile"): máy chủ ghi user_sessions nên người dùng
// hiện trong "Đang hoạt động" của Web Admin; gửi presence.ping mỗi 30 giây.
export class Realtime {
  private socket: Socket | null = null;
  private ping: ReturnType<typeof setInterval> | null = null;
  private bgTimer: ReturnType<typeof setTimeout> | null = null;
  private appState: NativeEventSubscription | null = null;

  constructor(private readonly handlers: RealtimeHandlers) {}

  get current(): Socket | null {
    return this.socket;
  }

  start(baseUrl: string): void {
    this.stop();
    const socket = io(baseUrl, {
      // auth dạng hàm: mỗi lần (kết nối lại) lấy access token mới nhất
      auth: (cb) => cb({ token: this.handlers.getToken() }),
      query: { clientType: "mobile" },
      transports: ["websocket"],
    });
    this.socket = socket;
    socket.on("connect", () => this.handlers.onStatus(true));
    socket.on("disconnect", () => this.handlers.onStatus(false));
    socket.on("connect_error", (err: Error & { data?: { code?: string } }) => {
      const code = err.data?.code ?? err.message;
      if (code === "AUTH_TOKEN_EXPIRED") {
        void this.handlers.onTokenExpired().then((ok) => (ok ? socket.connect() : this.handlers.onRevoked("SESSION_EXPIRED")));
      } else if (code === "ACCOUNT_LOCKED" || code === "AUTH_TOKEN_INVALID") {
        this.handlers.onRevoked(code);
      }
    });
    socket.on("session.revoked", (p: { reason?: string } | undefined) => this.handlers.onRevoked(p?.reason ?? "REVOKED"));
    this.ping = setInterval(() => {
      if (socket.connected) socket.emit("presence.ping", {});
    }, PING_INTERVAL_MS);
    this.appState = AppState.addEventListener("change", (s) => this.onAppState(s));
  }

  // Ứng dụng xuống nền quá 60 giây → đóng kết nối (khách không còn dùng app); quay lại → kết nối lại.
  private onAppState(state: AppStateStatus): void {
    if (!this.socket) return;
    if (state === "active") {
      if (this.bgTimer) clearTimeout(this.bgTimer);
      this.bgTimer = null;
      if (!this.socket.connected) this.socket.connect();
    } else if (!this.bgTimer) {
      this.bgTimer = setTimeout(() => {
        this.bgTimer = null;
        this.socket?.disconnect();
      }, BACKGROUND_CLOSE_MS);
    }
  }

  stop(): void {
    if (this.ping) clearInterval(this.ping);
    if (this.bgTimer) clearTimeout(this.bgTimer);
    this.ping = null;
    this.bgTimer = null;
    this.appState?.remove();
    this.appState = null;
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.handlers.onStatus(false);
  }
}
