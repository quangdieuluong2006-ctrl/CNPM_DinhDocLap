import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as api from "../lib/api";
import { usePrefs } from "../lib/prefs";

// ready: có phiên khách · none: không có phiên (API chưa chạy, khách bị khóa) – nội dung công khai vẫn dùng bình thường
type Status = "loading" | "ready" | "none";

interface AuthValue {
  status: Status;
  user: api.User | null;
  endSession: () => void; // bỏ phiên hiện tại, không tạo khách mới (tài khoản bị khóa)
}

const AuthContext = createContext<AuthValue | null>(null);

// Single-flight: React StrictMode (khi phát triển) chạy effect hai lần, nhiều yêu cầu cùng hết phiên… → chỉ khôi phục /
// tạo khách MỘT lần, tránh sinh nhiều khách ẩn danh cho cùng một trình duyệt.
let starting: Promise<api.Session | null> | null = null;

// Khách quét QR là dùng ngay, không đăng nhập / đăng ký. Mở trang lần đầu → API tạo một "khách ẩn danh" cho trình duyệt này
// (cookie rt_web); các lần sau chỉ khôi phục phiên. Nhờ phiên khách: lượt nghe gắn với lịch sử, khách hiện trong
// "Đang hoạt động" của Web Admin.
export function AuthProvider({ children }: { children: ReactNode }) {
  const { lang, ui } = usePrefs();
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<api.User | null>(null);
  // Ngôn ngữ đang chọn lúc tạo khách (không chạy lại hiệu ứng khi đổi ngôn ngữ)
  const prefs = useRef({ lang, ui });
  prefs.current = { lang, ui };

  const endSession = useCallback(() => {
    api.clearSession();
    setUser(null);
    setStatus("none");
  }, []);

  const begin = useCallback(async () => {
    starting ??= (async () => {
      try {
        return await api.refreshSession(); // đã có phiên khách từ lần trước (cookie rt_web)
      } catch (err) {
        if (err instanceof api.ApiError && err.code === "ACCOUNT_LOCKED") return null;
      }
      try {
        const { lang: narrationLang, ui: locale } = prefs.current;
        return await api.startGuest(narrationLang, locale === "vi" ? "vi" : "en");
      } catch {
        return null;
      }
    })().finally(() => {
      starting = null;
    });
    const s = await starting;
    if (!s) return endSession();
    setUser(s.user);
    setStatus("ready");
  }, [endSession]);

  useEffect(() => {
    // Phiên khách hết hạn giữa chừng (refresh token quá hạn) → lặng lẽ tạo khách mới, khách không phải làm gì
    api.setSessionExpiredHandler(() => void begin());
    void begin();
    return () => api.setSessionExpiredHandler(null);
  }, [begin]);

  const value = useMemo(() => ({ status, user, endSession }), [status, user, endSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải dùng bên trong <AuthProvider>");
  return ctx;
}
