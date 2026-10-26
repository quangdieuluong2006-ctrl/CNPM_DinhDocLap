import { Check, Search } from "lucide-react";
import { useState } from "react";
import { matchLanguage } from "../lib/i18n";
import { usePrefs } from "../lib/prefs";
import { useLanguages } from "../lib/queries";
import { ErrorState, Modal, Pill } from "./ui";

// Chọn ngôn ngữ thuyết minh: danh sách cuộn + ô tìm kiếm không dấu (giống FE-02 trên Mobile).
export function LanguagePicker({ onClose }: { onClose: () => void }) {
  const { lang, setLang, ui, t } = usePrefs();
  const languages = useLanguages();
  const [q, setQ] = useState("");
  const items = (languages.data ?? []).filter((l) => matchLanguage(l, q));

  return (
    <Modal title={t("chooseLanguage")} onClose={onClose} closeLabel={t("close")}>
      <span className="relative mb-3 block">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchLanguage")}
          className="w-full rounded-xl border py-3 pl-10 pr-4 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
        />
      </span>
      {languages.isError && <ErrorState message={t("error")} onRetry={() => void languages.refetch()} retryLabel={t("retry")} />}
      <ul className="-mx-1 flex-1 space-y-1.5 overflow-y-auto px-1">
        {items.map((l, i) => (
          <li key={l.code} style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }} className="animate-fade-up">
            <button
              onClick={() => {
                setLang(l.code);
                onClose();
              }}
              className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition hover:bg-brand-50 ${lang === l.code ? "border-brand-700 bg-brand-50" : "border-transparent bg-stone-50"}`}
            >
              <span className="flex-1">
                <span className="block text-lg font-semibold">{l.nameNative}</span>
                <span className="text-sm text-stone-500">
                  {ui === "vi" ? l.nameVi : l.nameEn} · {l.code}
                </span>
                {l.pending > 0 && (
                  <span className="mt-1 block">
                    <Pill tone="sky">{t("reviewing")}</Pill>
                  </span>
                )}
              </span>
              <span className="text-sm text-stone-500 tabular-nums">
                {l.approved + l.pending} {t("places")}
              </span>
              {lang === l.code && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-700 text-white">
                  <Check size={14} />
                </span>
              )}
            </button>
          </li>
        ))}
        {languages.data && items.length === 0 && <li className="py-6 text-center text-stone-500">{t("noLanguage")}</li>}
      </ul>
    </Modal>
  );
}
