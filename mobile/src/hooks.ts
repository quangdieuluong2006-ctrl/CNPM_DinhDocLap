import { useMemo } from "react";
import { translator } from "./i18n";
import { useApp } from "./state/store";

export function useT() {
  const { settings } = useApp();
  return useMemo(() => translator(settings.uiLocale), [settings.uiLocale]);
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
