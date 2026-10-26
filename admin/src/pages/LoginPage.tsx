import { Loader2, Lock, LogIn, Mail, Map as MapIcon, QrCode, Radio, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../features/auth/AuthProvider";
import { PalaceArt } from "../components/PalaceArt";
import { ApiError } from "../lib/api";

// Thông điệp theo mã lỗi chuẩn (PRD v1.0, mục 11.4)
function messageFor(err: unknown): string {
  if (!(err instanceof ApiError)) return "Đã có lỗi xảy ra, vui lòng thử lại";
  switch (err.code) {
    case "AUTH_INVALID_CREDENTIALS":
      return "Email hoặc mật khẩu không đúng";
    case "FORBIDDEN":
      return "Tài khoản không có quyền quản trị";
    case "ACCOUNT_LOCKED":
      return "Tài khoản đã bị khóa, vui lòng liên hệ hỗ trợ";
    case "RATE_LIMITED":
      return "Bạn đã thử quá nhiều lần, vui lòng đợi rồi thử lại";
    case "VALIDATION_ERROR":
      return "Vui lòng nhập email hợp lệ và mật khẩu";
    case "DB_UNAVAILABLE":
      return "Máy chủ chưa kết nối được SQL Server – kiểm tra SQL Server đã chạy chưa";
    case "NETWORK_ERROR":
      return "Không kết nối được máy chủ – kiểm tra API đã chạy chưa";
    default:
      return err.message;
  }
}

const FEATURES = [
  { icon: MapIcon, text: "Điểm thuyết minh ngoài trời (GPS) và trong nhà (QR)" },
  { icon: Radio, text: "Theo dõi người dùng và nhóm tham quan realtime" },
  { icon: QrCode, text: "In mã QR cho từng phòng trưng bày" },
];

export function LoginPage() {
  const { status, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated") {
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative flex animate-fade-up items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400 font-bold text-emerald-950">ĐĐL</span>
          <span className="text-lg font-semibold">Thuyết minh Dinh Độc Lập</span>
        </div>
        <div className="relative">
          <PalaceArt className="w-full animate-fade-in text-emerald-100" />
          <h2 className="mt-8 animate-fade-up text-3xl font-semibold leading-snug" style={{ animationDelay: "150ms" }}>
            Quản lý nội dung thuyết minh
            <br />
            <span className="text-amber-300">đa ngôn ngữ</span> theo thời gian thực
          </h2>
          <ul className="mt-6 space-y-3 text-emerald-100/90">
            {FEATURES.map(({ icon: Icon, text }, i) => (
              <li key={text} className="flex animate-fade-up items-center gap-3" style={{ animationDelay: `${250 + i * 80}ms` }}>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                  <Icon size={16} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-emerald-200/60">135 Nam Kỳ Khởi Nghĩa, Quận 1, TP. Hồ Chí Minh</p>
      </aside>

      <div className="flex items-center justify-center p-4">
        <form onSubmit={onSubmit} className="w-full max-w-sm animate-fade-up space-y-5 rounded-2xl border bg-white p-8 shadow-xl shadow-slate-200/60">
          <div>
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <ShieldCheck size={24} />
            </span>
            <h1 className="text-2xl font-semibold text-slate-900">Đăng nhập Web Admin</h1>
            <p className="text-sm text-slate-500">Chỉ dành cho tài khoản quản trị viên</p>
          </div>
          <label className="block text-sm">
            <span className="text-slate-700">Email</span>
            <span className="relative mt-1 block">
              <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border py-2.5 pl-9 pr-3 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
              />
            </span>
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Mật khẩu</span>
            <span className="relative mt-1 block">
              <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border py-2.5 pl-9 pr-3 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
              />
            </span>
          </label>
          {error && (
            <p role="alert" className="animate-fade-up rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.99] disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>
      </div>
    </div>
  );
}
