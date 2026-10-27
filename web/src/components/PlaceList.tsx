import { fold, ZONES, type TKey } from "../lib/i18n";
import { usePrefs } from "../lib/prefs";
import { usePlaces } from "../lib/queries";
import type { Place } from "../lib/types";
import { PlaceCard } from "./PlaceCard";
import { ErrorState } from "./ui";
import { zoneStyle } from "./ZoneArt";

export function filterPlaces(places: Place[], q: string, zone: string): Place[] {
  const needle = fold(q.trim());
  return places.filter(
    (p) =>
      (!zone || p.zone === zone) &&
      (!needle || p.code.includes(needle) || fold(p.content?.title ?? "").includes(needle) || fold(p.content?.summary ?? "").includes(needle)),
  );
}

// Danh sách thẻ điểm nhóm theo khu vực (FE-13), thứ tự theo lộ trình gợi ý.
export function PlaceList({ q = "", zone = "" }: { q?: string; zone?: string }) {
  const { lang, t } = usePrefs();
  const places = usePlaces(lang);
  if (places.isPending)
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-label={t("loading")}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-[106px]" />
        ))}
      </div>
    );
  if (places.isError) return <ErrorState message={t("error")} onRetry={() => void places.refetch()} retryLabel={t("retry")} />;

  const items = filterPlaces(places.data, q, zone).sort((a, b) => a.sortOrder - b.sortOrder);
  if (items.length === 0) return <p className="py-8 text-center text-stone-500">{t("noResult")}</p>;
  let n = 0; // thứ tự xuất hiện chung → các thẻ hiện lần lượt từ trên xuống
  return (
    <div className="space-y-6">
      {ZONES.map((z) => {
        const group = items.filter((p) => p.zone === z);
        if (group.length === 0) return null;
        const { icon: Icon } = zoneStyle(z);
        return (
          <section key={z}>
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-500">
              <Icon size={14} /> {t(z as TKey)} <span className="font-normal text-stone-400">· {group.length}</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.map((p) => (
                <PlaceCard key={p.id} place={p} delayMs={Math.min(n++, 12) * 40} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
