import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { translator, type UiLocale } from "./i18n";

// Lựa chọn của người xem: ngôn ngữ thuyết minh và ngôn ngữ giao diện, nhớ trong localStorage.
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
  ui: UiLocale;
  setUi: (l: UiLocale) => void;
  t: ReturnType<typeof translator>;
}

const PrefsContext = createContext<Prefs | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  // Ưu tiên ?lang= trên liên kết chia sẻ, sau đó lựa chọn đã nhớ, cuối cùng ngôn ngữ trình duyệt
  const fromUrl = new URLSearchParams(window.location.search).get("lang");
  const [lang, setLangState] = useState(() => fromUrl ?? read("narrationLang") ?? browserLang);
  const [ui, setUiState] = useState<UiLocale>(() => (read("uiLocale") as UiLocale | null) ?? (browserLang === "vi" ? "vi" : "en"));

  const setLang = useCallback((code: string) => {
    setLangState(code);
    write("narrationLang", code);
  }, []);
  const setUi = useCallback((l: UiLocale) => {
    setUiState(l);
    write("uiLocale", l);
    document.documentElement.lang = l;
  }, []);

  const value = useMemo(() => ({ lang, setLang, ui, setUi, t: translator(ui) }), [lang, setLang, ui, setUi]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs phải dùng bên trong <PrefsProvider>");
  return ctx;
}
