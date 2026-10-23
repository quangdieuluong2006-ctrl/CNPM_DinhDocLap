import { Link } from "react-router";
import { mediaUrl } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import type { Place } from "../lib/types";
import { CodeBadge, Pill } from "./ui";

export function PlaceCard({ place }: { place: Place }) {
  const { t } = usePrefs();
  const c = place.content;
  const image = mediaUrl(place.imageUrl);
  return (
    <Link
      to={`/p/${place.code}`}
      state={{ from: "list" }}
      className="flex gap-3 rounded-2xl border bg-white p-3 shadow-sm transition hover:border-brand-600 hover:shadow"
    >
      {image ? <img src={image} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" /> : <CodeBadge code={place.code} />}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          {image && <span className="font-mono text-xs font-bold text-brand-700">{place.code}</span>}
          <span className="truncate font-semibold">{c?.title ?? place.code}</span>
        </p>
        <p className="mt-0.5 line-clamp-2 text-sm text-stone-600">{c?.summary}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {c?.status === "pending" && <Pill tone="sky">{t("reviewing")}</Pill>}
          {c?.isFallback && (
            <Pill tone="gold">
              {t("showingIn")} {c.lang.toUpperCase()}
            </Pill>
          )}
          {place.content?.audioUrl && <Pill tone="brand">🔊</Pill>}
        </div>
      </div>
    </Link>
  );
}
