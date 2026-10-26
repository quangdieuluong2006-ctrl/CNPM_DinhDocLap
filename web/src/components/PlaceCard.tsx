import { ChevronRight, Volume2 } from "lucide-react";
import { Link } from "react-router";
import { mediaUrl } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import type { Place } from "../lib/types";
import { Pill } from "./ui";
import { ZoneThumb } from "./ZoneArt";

export function PlaceCard({ place, delayMs = 0 }: { place: Place; delayMs?: number }) {
  const { t } = usePrefs();
  const c = place.content;
  const image = mediaUrl(place.imageUrl);
  return (
    <Link
      to={`/p/${place.code}`}
      state={{ from: "list" }}
      style={{ animationDelay: `${delayMs}ms` }}
      className="group flex animate-fade-up gap-3 rounded-2xl border bg-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-600 hover:shadow-md"
    >
      <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
        {image ? (
          <img src={image} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <ZoneThumb zone={place.zone} className="h-full w-full transition duration-300 group-hover:scale-105" />
        )}
        <span className="absolute bottom-1 left-1 rounded-md bg-black/55 px-1.5 font-mono text-[11px] font-bold text-white backdrop-blur-sm">{place.code}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{c?.title ?? place.code}</p>
        <p className="mt-0.5 line-clamp-2 text-sm text-stone-600">{c?.summary}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {c?.status === "pending" && <Pill tone="sky">{t("reviewing")}</Pill>}
          {c?.isFallback && (
            <Pill tone="gold">
              {t("showingIn")} {c.lang.toUpperCase()}
            </Pill>
          )}
          {place.content?.audioUrl && (
            <Pill tone="brand">
              <Volume2 size={12} />
            </Pill>
          )}
        </div>
      </div>
      <ChevronRight size={18} className="shrink-0 self-center text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-brand-700" />
    </Link>
  );
}
