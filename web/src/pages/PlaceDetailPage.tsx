import { useCallback } from "react";
import { Link, useLocation, useParams } from "react-router";
import { CampusMap } from "../components/CampusMap";
import { Player } from "../components/Player";
import { useRealtime } from "../features/realtime";
import { CodeBadge, ErrorState, Pill } from "../components/ui";
import { ApiError, mediaUrl, sendVisit } from "../lib/api";
import type { TKey } from "../lib/i18n";
import { usePrefs } from "../lib/prefs";
import { useLanguages, usePlace } from "../lib/queries";
import type { Trigger } from "../lib/types";

// FE-14 Chi tiết điểm và nghe thuyết minh. Đây cũng là đích của mã QR in tại phòng: https://<web-user>/p/201
export function PlaceDetailPage() {
  const { code = "" } = useParams();
  const location = useLocation();
  const { lang, setLang, t } = usePrefs();
  const place = usePlace(code, lang);
  const languages = useLanguages();
  const { socket } = useRealtime();
  // Mở từ danh sách = chọn tay; mở thẳng liên kết (quét QR) = qr
  const trigger: Trigger = (location.state as { from?: string } | null)?.from === "list" ? "manual" : "qr";

  const p = place.data;
  const c = p?.content;
  const onFinish = useCallback(
    (listenedSec: number, completed: boolean, startedAt: string) => {
      if (p && c) sendVisit({ placeId: p.id, lang: c.lang, trigger, listenedSec, completed, startedAt });
    },
    [p, c, trigger],
  );

  if (place.isPending) return <p className="text-stone-500">{t("loading")}</p>;
  if (place.isError) {
    const notFound = place.error instanceof ApiError && place.error.status === 404;
    return (
      <div className="space-y-4">
        {notFound ? (
          <p className="text-xl font-semibold">
            {t("notFound")} {code}
          </p>
        ) : (
          <ErrorState message={t("error")} onRetry={() => void place.refetch()} retryLabel={t("retry")} />
        )}
        <Link to="/places" className="text-brand-700 hover:underline">
          ‹ {t("backToList")}
        </Link>
      </div>
    );
  }

  const image = mediaUrl(p!.imageUrl);
  const ttsLocale = languages.data?.find((l) => l.code === c?.lang)?.ttsLocale ?? c?.lang ?? "vi-VN";
  const available = (languages.data ?? []).filter((l) => p!.languages.includes(l.code));

  return (
    <article className="mx-auto max-w-2xl space-y-5">
      <Link to="/places" className="text-sm text-brand-700 hover:underline">
        ‹ {t("backToList")}
      </Link>
      {image && <img src={image} alt="" className="h-56 w-full rounded-2xl object-cover" />}
      <header className="flex items-center gap-4">
        <CodeBadge code={p!.code} size="lg" />
        <div>
          <h1 className="text-2xl font-bold leading-tight">{c?.title ?? p!.code}</h1>
          <p className="text-sm text-stone-500">
            {t(p!.zone as TKey)} · {p!.trigger === "gps" ? t("autoTrigger") : t("indoorTrigger")}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {c?.status === "pending" && <Pill tone="sky">{t("reviewing")}</Pill>}
        {c?.isFallback && (
          <Pill tone="gold">
            {t("showingIn")} {c.lang.toUpperCase()} ({lang.toUpperCase()}: {t("noTranslation")})
          </Pill>
        )}
      </div>

      {c && (
        <Player
          source={{ key: `${p!.code}-${c.lang}`, audioUrl: mediaUrl(c.audioUrl), text: `${c.title}. ${c.body ?? c.summary}`, ttsLocale }}
          onFinish={onFinish}
          // Đang ở nhóm tham quan: báo cho cả nhóm điểm mình đang nghe (chỉ placeId, không gửi tọa độ)
          onStart={() => socket?.emit("tour.position", { placeId: p!.id })}
        />
      )}

      {available.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {available.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`rounded-full border px-3 py-1 text-sm ${l.code === c?.lang ? "border-brand-700 bg-brand-50 font-semibold text-brand-800" : "bg-white hover:bg-stone-50"}`}
            >
              {l.nameNative}
            </button>
          ))}
        </div>
      )}

      <p className="text-lg font-medium leading-relaxed">{c?.summary}</p>
      <div className="whitespace-pre-line text-base leading-8 text-stone-800">{c?.body}</div>

      {/* Bản đồ nhỏ cho điểm ngoài trời; điểm trong nhà chỉ ghi khu vực vì GPS không phân biệt tầng */}
      {p!.trigger === "gps" ? (
        <CampusMap places={[p!]} center={[p!.lat, p!.lng]} zoom={18} height={220} interactive={false} highlightCode={p!.code} />
      ) : (
        <p className="rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-600">
          📍 {t("whereIndoor")} · {t(p!.zone as TKey)}
        </p>
      )}
    </article>
  );
}
