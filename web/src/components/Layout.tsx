import { Headphones, Home, List, Map as MapIcon, Users } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../features/auth";
import { usePrefs } from "../lib/prefs";
import { useLanguages } from "../lib/queries";
import { LanguagePicker } from "./LanguagePicker";

export function Layout() {
  const { lang, ui, setUi, t } = usePrefs();
  const { status, user } = useAuth();
  const languages = useLanguages();
  const [picking, setPicking] = useState(false);
  const location = useLocation();
  const current = languages.data?.find((l) => l.code === lang);
  const nav = [
    { to: "/", label: t("navHome"), end: true, icon: Home },
    { to: "/places", label: t("navPlaces"), end: false, icon: List },
    { to: "/map", label: t("navMap"), end: false, icon: MapIcon },
    { to: "/tour", label: t("navTour"), end: false, icon: Users },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-[500] border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-2.5 sm:flex-nowrap sm:gap-3 sm:py-3">
          <Link to="/" className="mr-auto flex items-center gap-2 font-semibold text-brand-800">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-sm text-white">ĐĐL</span>
            <span className="hidden sm:inline">{t("brand")}</span>
          </Link>
          {/* Điện thoại: menu xuống dòng riêng bên dưới để không tràn màn hình 360 px */}
          <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto text-sm sm:order-none sm:mx-0 sm:w-auto">
            {nav.map(({ to, end, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 transition-colors sm:px-3 ${isActive ? "bg-brand-50 font-medium text-brand-800" : "text-stone-600 hover:bg-stone-100"}`
                }
              >
                <Icon size={15} className="hidden sm:inline" /> {label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={() => setPicking(true)}
            title={t("narration")}
            className="whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-sm font-medium hover:bg-stone-50"
          >
            <Headphones size={15} className="inline align-[-2px]" /> <span className="sm:hidden">{lang.toUpperCase()}</span>
            <span className="hidden sm:inline">{current?.nameNative ?? lang.toUpperCase()}</span>
          </button>
          {status === "authenticated" ? (
            <Link to="/me" title={t("account")} className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">
              {user?.fullName.trim().charAt(0).toUpperCase()}
            </Link>
          ) : (
            <Link to="/login" className="whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50">
              {t("login")}
            </Link>
          )}
          <button
            onClick={() => setUi(ui === "vi" ? "en" : "vi")}
            title="Ngôn ngữ giao diện / App language"
            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-stone-500 hover:bg-stone-100"
          >
            {ui === "vi" ? "EN" : "VI"}
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {/* key theo đường dẫn → mỗi lần chuyển trang, nội dung hiện dần lên */}
        <div key={location.pathname} className="animate-fade-up">
          <Outlet />
        </div>
      </main>
      <footer className="border-t py-6 text-center text-xs text-stone-500">{t("brand")} · Dinh Độc Lập, 135 Nam Kỳ Khởi Nghĩa, TP.HCM</footer>
      {picking && <LanguagePicker onClose={() => setPicking(false)} />}
    </div>
  );
}
