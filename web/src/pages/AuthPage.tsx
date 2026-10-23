import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../features/auth";
import { ApiError } from "../lib/api";
import type { TKey } from "../lib/i18n";
import { usePrefs } from "../lib/prefs";

function messageKey(err: unknown): TKey {
  if (!(err instanceof ApiError)) return "error";
  switch (err.code) {
    case "AUTH_INVALID_CREDENTIALS":
      return "errInvalid";
    case "ACCOUNT_LOCKED":
      return "errLocked";
    case "EMAIL_TAKEN":
      return "errEmailTaken";
    case "RATE_LIMITED":
      return "errRate";
    case "VALIDATION_ERROR":
      return "errValidation";
    case "NETWORK_ERROR":
    case "DB_UNAVAILABLE":
      return "errNetwork";
    default:
      return "error";
  }
}

const inputCls = "mt-1 w-full rounded-xl border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-brand-600";

// FE-16 Đăng nhập / đăng ký: giao diện chia đôi (giới thiệu bên trái, biểu mẫu bên phải), hiện/ẩn mật khẩu.
export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { status, login, register } = useAuth();
  const { lang, ui, t } = usePrefs();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/me";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<TKey | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "authenticated") return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register({ email: email.trim(), password, fullName: fullName.trim(), locale: ui, narrationLang: lang });
      navigate(from, { replace: true });
    } catch (err) {
      setError(messageKey(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border bg-white shadow-sm md:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-gradient-to-br from-brand-800 to-brand-600 p-8 text-white md:flex">
        <p className="text-sm font-medium uppercase tracking-widest text-gold-500">Dinh Độc Lập</p>
        <p className="text-2xl font-semibold leading-snug">{t("heroTitle")}</p>
        <p className="text-sm text-white/80">{t("authAside")}</p>
      </aside>
      <form onSubmit={onSubmit} className="space-y-4 p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{mode === "login" ? t("login") : t("register")}</h1>
        <p className="text-sm text-stone-600 md:hidden">{t("authAside")}</p>
        {mode === "register" && (
          <label className="block text-sm font-medium">
            {t("fullName")}
            <input required maxLength={100} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
          </label>
        )}
        <label className="block text-sm font-medium">
          {t("email")}
          <input required type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-sm font-medium">
          {t("password")}
          <span className="relative block">
            <input
              required
              type={show ? "text" : "password"}
              minLength={mode === "register" ? 8 : undefined}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputCls} pr-16`}
            />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 pt-1 text-sm font-medium text-brand-700">
              {show ? t("hidePassword") : t("showPassword")}
            </button>
          </span>
          {mode === "register" && <span className="mt-1 block text-xs font-normal text-stone-500">{t("passwordHint")}</span>}
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {t(error)}
          </p>
        )}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-brand-700 py-3 font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
          {busy ? "…" : mode === "login" ? t("login") : t("register")}
        </button>
        <p className="text-center text-sm text-stone-600">
          {mode === "login" ? t("noAccount") : t("haveAccount")}{" "}
          <Link to={mode === "login" ? "/register" : "/login"} state={location.state} className="font-semibold text-brand-700 hover:underline">
            {mode === "login" ? t("register") : t("login")}
          </Link>
        </p>
      </form>
    </div>
  );
}
