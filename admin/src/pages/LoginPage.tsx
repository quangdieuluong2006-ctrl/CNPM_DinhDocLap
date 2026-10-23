import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../features/auth/AuthProvider";
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
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl border bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Đăng nhập Web Admin</h1>
          <p className="text-sm text-slate-500">Chỉ dành cho tài khoản quản trị viên</p>
        </div>
        <label className="block text-sm">
          <span className="text-slate-700">Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Mật khẩu</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
          />
        </label>
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </div>
  );
}
