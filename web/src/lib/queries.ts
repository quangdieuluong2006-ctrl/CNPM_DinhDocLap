import { useQuery } from "@tanstack/react-query";
import { publicGet } from "./api";
import type { Language, Place, PlaceDetail } from "./types";

export function useLanguages() {
  return useQuery({
    queryKey: ["languages"],
    queryFn: async () => (await publicGet<{ items: Language[] }>("/languages")).items,
    staleTime: 5 * 60_000,
  });
}

export function usePlaces(lang: string) {
  return useQuery({
    queryKey: ["places", lang],
    queryFn: async () => (await publicGet<{ items: Place[] }>(`/places?lang=${encodeURIComponent(lang)}`)).items,
  });
}

export function usePlace(code: string, lang: string) {
  return useQuery({
    queryKey: ["place", code, lang],
    queryFn: () => publicGet<PlaceDetail>(`/places/${encodeURIComponent(code)}?lang=${encodeURIComponent(lang)}`),
  });
}
