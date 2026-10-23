import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as api from "../../lib/api";

type Status = "loading" | "authenticated" | "guest";

interface AuthContextValue {
  status: Status;
  user: api.User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<api.User | null>(null);

  const toGuest = useCallback(() => {
    api.clearSession();
    setUser(null);
    setStatus("guest");
  }, []);

  // Mở trang: thử khôi phục phiên từ cookie rt_admin (giữ đăng nhập khi tải lại trang).
  useEffect(() => {
    api.setSessionExpiredHandler(toGuest);
    api
      .refreshSession()
      .then((s) => {
        setUser(s.user);
        setStatus("authenticated");
      })
      .catch(() => setStatus("guest"));
    return () => api.setSessionExpiredHandler(null);
  }, [toGuest]);

  const login = useCallback(async (email: string, password: string) => {
    const s = await api.login(email, password);
    setUser(s.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    toGuest();
  }, [toGuest]);

  const value = useMemo(() => ({ status, user, login, logout }), [status, user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải dùng bên trong <AuthProvider>");
  return ctx;
}
