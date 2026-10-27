import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translator, uiLocaleFor, type UiLocale } from "./i18n";

// Lựa chọn của người xem: ngôn ngữ thuyết minh (nhớ trong localStorage); giao diện hiển thị theo chính ngôn ngữ đó.
// Trình duyệt chặn lưu trữ (chế độ riêng tư) thì vẫn chạy, chỉ không nhớ.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // bỏ qua
  }
}

const browserLang = (navigator.language || "vi").slice(0, 2).toLowerCase();

interface Prefs {
  lang: string; // ngôn ngữ thuyết minh (ISO 639-1)
  setLang: (code: string) => void;
  ui: UiLocale; // ngôn ngữ giao diện = ngôn ngữ thuyết minh (tiếng Anh nếu chưa có bản dịch giao diện)
  t: ReturnType<typeof translator>;
}

const PrefsContext = createContext<Prefs | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  // Ưu tiên ?lang= trên liên kết chia sẻ, sau đó lựa chọn đã nhớ, cuối cùng ngôn ngữ trình duyệt
  const fromUrl = new URLSearchParams(window.location.search).get("lang");
  const [lang, setLangState] = useState(() => fromUrl ?? read("narrationLang") ?? browserLang);

  const setLang = useCallback((code: string) => {
    setLangState(code);
    write("narrationLang", code);
  }, []);
  const ui = uiLocaleFor(lang);
  useEffect(() => {
    document.documentElement.lang = ui;
  }, [ui]);

  const value = useMemo(() => ({ lang, setLang, ui, t: translator(ui) }), [lang, setLang, ui]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs phải dùng bên trong <PrefsProvider>");
  return ctx;
}
