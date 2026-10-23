import { useState } from "react";
import { Link } from "react-router";
import { LanguagePicker } from "../components/LanguagePicker";
import { PlaceList } from "../components/PlaceList";
import { usePrefs } from "../lib/prefs";
import { useLanguages } from "../lib/queries";

// FE-13 Trang chủ: giới thiệu, chọn ngôn ngữ, danh sách điểm.
export function HomePage() {
  const { lang, t } = usePrefs();
  const languages = useLanguages();
  const [picking, setPicking] = useState(false);
  const current = languages.data?.find((l) => l.code === lang);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 to-brand-600 p-6 text-white sm:p-10">
        <p className="text-sm font-medium uppercase tracking-widest text-gold-500">Dinh Độc Lập · Independence Palace</p>
        <h1 className="mt-2 max-w-2xl text-2xl font-bold leading-tight sm:text-4xl">{t("heroTitle")}</h1>
        <p className="mt-3 max-w-2xl text-white/85">{t("heroText")}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button onClick={() => setPicking(true)} className="rounded-xl bg-white px-5 py-3 font-semibold text-brand-800 hover:bg-brand-50">
            🎧 {t("narration")}: {current?.nameNative ?? lang.toUpperCase()}
          </button>
          <Link to="/places" className="rounded-xl border border-white/40 px-5 py-3 font-semibold hover:bg-white/10">
            {t("allPlaces")} →
          </Link>
        </div>
        <p className="mt-6 text-sm text-white/70">📱 {t("getApp")}</p>
      </section>
      <PlaceList />
      {picking && <LanguagePicker onClose={() => setPicking(false)} />}
    </div>
  );
}
