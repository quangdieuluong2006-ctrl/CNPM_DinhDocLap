import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { CodeBadge, ErrorState, Pill } from "../components/ui";
import { useAuth } from "../features/auth";
import { useRealtime } from "../features/realtime";
import { authRequest } from "../lib/api";
import { usePrefs } from "../lib/prefs";

interface MyVisit {
  id: number;
  placeId: number;
  placeCode: string;
  title: string;
  lang: string;
  trigger: string;
  listenedSec: number;
  completed: boolean;
  startedAt: string;
}

const PAGE_SIZE = 20;

// FE-16 Trang tài khoản: thông tin và lịch sử các điểm đã nghe (GET /me/visits, phân trang).
export function MePage() {
  const { user, logout } = useAuth();
  const { connected } = useRealtime();
  const { ui, t } = usePrefs();
  const visits = useInfiniteQuery({
    queryKey: ["me", "visits"],
    queryFn: ({ pageParam }) => authRequest<{ items: MyVisit[]; total: number; page: number }>(`/me/visits?page=${pageParam}&pageSize=${PAGE_SIZE}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * PAGE_SIZE < last.total ? last.page + 1 : undefined),
  });
  const myTour = useQuery({ queryKey: ["me", "tour"], queryFn: () => authRequest<{ tour: { code: string; name: string } | null }>("/me/tour") });
  const fmt = new Intl.DateTimeFormat(ui === "vi" ? "vi-VN" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
  const items = visits.data?.pages.flatMap((p) => p.items) ?? [];
  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border bg-white p-5 shadow-sm">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-xl font-bold text-white">
          {user.fullName.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">{user.fullName}</p>
          <p className="text-sm text-stone-500">{user.email}</p>
          <p className="mt-1 flex flex-wrap gap-1.5 text-xs text-stone-500">
            {t("memberSince")} {fmt.format(new Date(user.createdAt))}
            {connected && <Pill tone="brand">● {t("online")}</Pill>}
          </p>
        </div>
        <button onClick={() => void logout()} className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-stone-50">
          {t("logout")}
        </button>
      </section>

      {myTour.data?.tour && (
        <Link to={`/tour/${myTour.data.tour.code}`} className="flex items-center justify-between rounded-2xl border border-gold-500 bg-amber-50 p-4 hover:bg-amber-100">
          <span>
            <span className="block text-xs font-bold uppercase tracking-wider text-amber-800">{t("myTour")}</span>
            <span className="font-semibold">{myTour.data.tour.name}</span> <span className="font-mono text-sm">({myTour.data.tour.code})</span>
          </span>
          <span className="font-semibold text-brand-700">{t("open")} →</span>
        </Link>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          {t("history")} {visits.data && <span className="text-stone-400">({visits.data.pages[0]?.total ?? 0})</span>}
        </h2>
        {visits.isError && <ErrorState message={t("error")} onRetry={() => void visits.refetch()} retryLabel={t("retry")} />}
        {visits.isPending && <p className="text-stone-500">{t("loading")}</p>}
        {visits.data && items.length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-center text-stone-500">
            {t("noHistory")}{" "}
            <Link to="/places" className="font-semibold text-brand-700 hover:underline">
              {t("allPlaces")} →
            </Link>
          </p>
        )}
        <ul className="space-y-2">
          {items.map((v) => (
            <li key={v.id}>
              <Link to={`/p/${v.placeCode}`} state={{ from: "list" }} className="flex items-center gap-3 rounded-2xl border bg-white p-3 hover:border-brand-600">
                <CodeBadge code={v.placeCode} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{v.title}</span>
                  <span className="text-xs text-stone-500">
                    {fmt.format(new Date(v.startedAt))} · {v.lang.toUpperCase()} · {t("listenedFor")} {Math.floor(v.listenedSec / 60)}:{String(v.listenedSec % 60).padStart(2, "0")}
                  </span>
                </span>
                {v.completed && <Pill tone="brand">✓ {t("completed")}</Pill>}
              </Link>
            </li>
          ))}
        </ul>
        {visits.hasNextPage && (
          <button onClick={() => void visits.fetchNextPage()} disabled={visits.isFetchingNextPage} className="w-full rounded-xl border bg-white py-2.5 text-sm font-medium hover:bg-stone-50">
            {t("more")}
          </button>
        )}
      </section>
    </div>
  );
}
