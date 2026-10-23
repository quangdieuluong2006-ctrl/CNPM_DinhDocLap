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
    <Modal title={t("chooseLanguage")} onClose={onClose}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("searchLanguage")}
        className="mb-3 w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-brand-600"
      />
      {languages.isError && <ErrorState message={t("error")} onRetry={() => void languages.refetch()} retryLabel={t("retry")} />}
      <ul className="-mx-1 flex-1 space-y-1.5 overflow-y-auto px-1">
        {items.map((l) => (
          <li key={l.code}>
            <button
              onClick={() => {
                setLang(l.code);
                onClose();
              }}
              className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left hover:bg-brand-50 ${lang === l.code ? "border-brand-700" : "border-transparent bg-stone-50"}`}
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
            </button>
          </li>
        ))}
        {languages.data && items.length === 0 && <li className="py-6 text-center text-stone-500">{t("noLanguage")}</li>}
      </ul>
    </Modal>
  );
}
