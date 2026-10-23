import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CampusMap } from "../components/CampusMap";
import { CodeBadge, ErrorState } from "../components/ui";
import { usePrefs } from "../lib/prefs";
import { usePlaces } from "../lib/queries";
import type { Place } from "../lib/types";

// FE-15 Bản đồ khuôn viên (web): marker điểm ngoài trời + vùng kích hoạt, marker gộp các phòng trong nhà,
// vị trí của trình duyệt nếu người dùng cho phép (không gửi lên máy chủ).
export function MapPage() {
  const { lang, t } = usePrefs();
  const places = usePlaces(lang);
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Place | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    if (!watching || !("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => setGeoError(true),
      { enableHighAccuracy: true },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [watching]);

  if (places.isError) return <ErrorState message={t("error")} onRetry={() => void places.refetch()} retryLabel={t("retry")} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t("navMap")}</h1>
        <button
          onClick={() => setWatching(true)}
          disabled={watching && !geoError}
          className="rounded-xl border bg-white px-3 py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-60"
        >
          📍 {t("myLocation")}
        </button>
      </div>
      <p className="text-sm text-stone-600">{t("mapHint")}</p>
      {geoError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t("geoDenied")}</p>}
      <CampusMap places={places.data ?? []} onSelect={setSelected} onBuilding={() => navigate("/places")} highlightCode={selected?.code} me={me} height="60vh" />
      {selected && (
        <Link to={`/p/${selected.code}`} state={{ from: "list" }} className="flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm hover:border-brand-600">
          <CodeBadge code={selected.code} />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{selected.content?.title}</span>
            <span className="line-clamp-1 text-sm text-stone-600">{selected.content?.summary}</span>
          </span>
          <span className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white">▶ {t("listen")}</span>
        </Link>
      )}
    </div>
  );
}
