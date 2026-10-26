import { Eye, EyeOff, Loader2, Lock, LogIn, Mail, User, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../features/auth";
import { ApiError } from "../lib/api";
import type { TKey } from "../lib/i18n";
import { HERO_PHOTO } from "../lib/photos";
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

const inputCls = "w-full rounded-xl border bg-white py-3 pl-10 pr-4 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100";
const iconCls = "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400";

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
    <div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border bg-white shadow-lg md:grid-cols-2">
      <aside className="relative hidden min-h-[480px] flex-col justify-between overflow-hidden p-8 text-white md:flex">
        <img src={HERO_PHOTO.src} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-900 via-brand-900/70 to-brand-900/20" />
        <p className="relative text-sm font-medium uppercase tracking-widest text-gold-500">Dinh Độc Lập</p>
        <div className="relative animate-fade-up">
          <p className="text-2xl font-semibold leading-snug">{t("heroTitle")}</p>
          <p className="mt-3 text-sm text-white/80">{t("authAside")}</p>
          <p className="mt-4 text-[11px] text-white/50">
            {t("photoBy")}: {HERO_PHOTO.credit}
          </p>
        </div>
      </aside>
      <form onSubmit={onSubmit} className="animate-fade-up space-y-4 p-6 sm:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          {mode === "login" ? <LogIn size={22} /> : <UserPlus size={22} />}
        </span>
        <h1 className="text-2xl font-bold">{mode === "login" ? t("login") : t("register")}</h1>
        <p className="text-sm text-stone-600 md:hidden">{t("authAside")}</p>
        {mode === "register" && (
          <label className="block text-sm font-medium">
            {t("fullName")}
            <span className="relative mt-1 block">
              <User size={18} className={iconCls} />
              <input required maxLength={100} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
            </span>
          </label>
        )}
        <label className="block text-sm font-medium">
          {t("email")}
          <span className="relative mt-1 block">
            <Mail size={18} className={iconCls} />
            <input required type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </span>
        </label>
        <label className="block text-sm font-medium">
          {t("password")}
          <span className="relative mt-1 block">
            <Lock size={18} className={iconCls} />
            <input
              required
              type={show ? "text" : "password"}
              minLength={mode === "register" ? 8 : undefined}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls.replace("pr-4", "pr-12")}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? t("hidePassword") : t("showPassword")}
              title={show ? t("hidePassword") : t("showPassword")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-stone-500 hover:bg-stone-100 hover:text-brand-700"
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
          {mode === "register" && <span className="mt-1 block text-xs font-normal text-stone-500">{t("passwordHint")}</span>}
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {t(error)}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.99] disabled:opacity-60"
        >
          {busy && <Loader2 size={18} className="animate-spin" />}
          {mode === "login" ? t("login") : t("register")}
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
