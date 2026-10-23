import { useSearchParams } from "react-router";
import { PlaceList } from "../components/PlaceList";
import { ZONES, type TKey } from "../lib/i18n";
import { usePrefs } from "../lib/prefs";

// FE-13 Danh sách điểm: tìm kiếm + lọc khu vực; tham số nằm trên URL (/places?zone=&q=) để chia sẻ được.
export function PlacesPage() {
  const { t } = usePrefs();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const zone = params.get("zone") ?? "";
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t("allPlaces")}</h1>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={q}
          onChange={(e) => update("q", e.target.value)}
          placeholder={t("searchPlace")}
          className="flex-1 rounded-xl border bg-white px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-600"
        />
        <select value={zone} onChange={(e) => update("zone", e.target.value)} className="rounded-xl border bg-white px-3 py-2.5">
          <option value="">{t("allZones")}</option>
          {ZONES.map((z) => (
            <option key={z} value={z}>
              {t(z as TKey)}
            </option>
          ))}
        </select>
      </div>
      <PlaceList q={q} zone={zone} />
    </div>
  );
}
