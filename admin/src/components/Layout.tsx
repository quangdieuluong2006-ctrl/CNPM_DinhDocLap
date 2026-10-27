import { Activity, Languages, LayoutDashboard, LogOut, MapPin, QrCode, Radio, ScrollText, Users, type LucideIcon } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../features/auth/AuthProvider";
import { useRealtime } from "../features/realtime/RealtimeProvider";
import { PalaceArt } from "./PalaceArt";

const navItems: { to: string; label: string; end: boolean; icon: LucideIcon }[] = [
  { to: "/", label: "Tổng quan", end: true, icon: LayoutDashboard },
  { to: "/active-users", label: "Đang hoạt động", end: false, icon: Activity },
  { to: "/users", label: "Người dùng", end: false, icon: Users },
  { to: "/places", label: "Điểm thuyết minh", end: false, icon: MapPin },
  { to: "/languages", label: "Ngôn ngữ", end: false, icon: Languages },
  { to: "/activity", label: "Nhật ký hoạt động", end: false, icon: ScrollText },
  { to: "/print-qr", label: "In mã QR", end: false, icon: QrCode },
];

export function Layout() {
  const { user, logout } = useAuth();
  const { connected, last } = useRealtime();
  const location = useLocation();
  const initial = user?.fullName.trim().charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-emerald-950 via-emerald-950 to-emerald-900 text-emerald-50 print:hidden">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-sm font-bold text-emerald-950 shadow-lg shadow-amber-500/20">ĐĐL</span>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-emerald-300/80">Dinh Độc Lập</p>
            <p className="text-lg font-semibold leading-tight">Web Admin</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map(({ to, label, end, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200 ${
                  isActive ? "bg-white/10 font-medium text-white" : "text-emerald-100/75 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`absolute inset-y-2 left-0 w-1 rounded-r bg-amber-400 transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`} />
                  <Icon size={18} className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? "text-amber-300" : ""}`} />
                  {label}
                  {to === "/active-users" && last && last.activeUsers > 0 && (
                    <span className="ml-auto rounded-full bg-emerald-500/90 px-2 text-xs font-semibold text-white">{last.activeUsers}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <PalaceArt className="mx-4 mb-4 text-emerald-200/60" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[600] flex items-center justify-between border-b bg-white/80 px-6 py-3 backdrop-blur print:hidden">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${connected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            <span className="relative flex h-2.5 w-2.5">
              {connected && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`} />
            </span>
            <Radio size={14} />
            {connected ? "Realtime đã kết nối" : "Mất kết nối realtime – đang thử lại"}
          </span>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 font-semibold text-white">{initial}</span>
            <span className="hidden leading-tight sm:block">
              <span className="block font-medium text-slate-800">{user?.fullName}</span>
              <span className="text-xs text-slate-400">{user?.email}</span>
            </span>
            <button onClick={() => void logout()} className="ml-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-slate-600 transition-colors hover:bg-slate-100">
              <LogOut size={15} /> Đăng xuất
            </button>
          </div>
        </header>
        <main className="flex-1 p-6 print:p-0">
          {/* key theo đường dẫn → mỗi lần chuyển trang, nội dung hiện dần lên */}
          <div key={location.pathname} className="animate-fade-up print:animate-none">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
