import { ArrowRight, Headphones, Languages, MapPin, QrCode, Smartphone, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { LanguagePicker } from "../components/LanguagePicker";
import { PlaceList } from "../components/PlaceList";
import type { TKey } from "../lib/i18n";
import { HERO_PHOTO } from "../lib/photos";
import { usePrefs } from "../lib/prefs";
import { useLanguages, usePlaces } from "../lib/queries";

const STEPS: { icon: LucideIcon; title: TKey; text: TKey }[] = [
  { icon: Languages, title: "step1Title", text: "step1Text" },
  { icon: QrCode, title: "step2Title", text: "step2Text" },
  { icon: Headphones, title: "step3Title", text: "step3Text" },
];

// FE-13 Trang chủ: giới thiệu, chọn ngôn ngữ, các bước sử dụng, danh sách điểm.
export function HomePage() {
  const { lang, t } = usePrefs();
  const languages = useLanguages();
  const places = usePlaces(lang);
  const [picking, setPicking] = useState(false);
  const current = languages.data?.find((l) => l.code === lang);

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-6 text-white shadow-lg sm:p-10">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gold-500/15 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="animate-fade-up text-sm font-medium uppercase tracking-widest text-gold-500">Dinh Độc Lập · Independence Palace</p>
            <h1 className="mt-2 max-w-2xl animate-fade-up text-2xl font-bold leading-tight sm:text-4xl" style={{ animationDelay: "80ms" }}>
              {t("heroTitle")}
            </h1>
            <p className="mt-3 max-w-2xl animate-fade-up text-white/85" style={{ animationDelay: "160ms" }}>
              {t("heroText")}
            </p>
            <div className="mt-6 flex animate-fade-up flex-wrap items-center gap-3" style={{ animationDelay: "240ms" }}>
              <button
                onClick={() => setPicking(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-brand-800 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-brand-50"
              >
                <Headphones size={18} /> {t("narration")}: {current?.nameNative ?? lang.toUpperCase()}
              </button>
              <Link to="/places" className="group inline-flex items-center gap-2 rounded-xl border border-white/40 px-5 py-3 font-semibold transition hover:bg-white/10">
                {t("allPlaces")} <ArrowRight size={18} className="transition group-hover:translate-x-1" />
              </Link>
            </div>
            <div className="mt-6 flex animate-fade-up flex-wrap gap-2 text-sm" style={{ animationDelay: "320ms" }}>
              {places.data && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
                  <MapPin size={14} /> {places.data.length} {t("statPlaces")}
                </span>
              )}
              {languages.data && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
                  <Languages size={14} /> {languages.data.length} {t("statLangs")}
                </span>
              )}
            </div>
          </div>
          <figure className="relative animate-fade-in">
            <div className="absolute -inset-2 rotate-2 rounded-3xl bg-gold-500/30" />
            <img src={HERO_PHOTO.src} alt="Dinh Độc Lập" className="relative aspect-[3/2] w-full rounded-2xl object-cover shadow-2xl ring-4 ring-white/20" />
            <figcaption className="relative mt-2 text-right text-[11px] text-white/60">
              {t("photoBy")}: {HERO_PHOTO.credit ?? t("photoCollected")}
            </figcaption>
          </figure>
        </div>
        <p className="relative mt-6 flex items-center gap-2 text-sm text-white/70">
          <Smartphone size={16} /> {t("getApp")}
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">{t("howTitle")}</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li
              key={title}
              style={{ animationDelay: `${i * 100}ms` }}
              className="relative animate-fade-up rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="absolute right-4 top-3 text-4xl font-bold text-stone-100">{i + 1}</span>
              <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon size={22} />
              </span>
              <p className="relative mt-3 font-semibold">{t(title)}</p>
              <p className="relative mt-1 text-sm text-stone-600">{t(text)}</p>
            </li>
          ))}
        </ol>
      </section>

      <PlaceList />
      {picking && <LanguagePicker onClose={() => setPicking(false)} />}
    </div>
  );
}
