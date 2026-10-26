import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, Clock, Flag, Headphones, LogOut } from "lucide-react";
import { Link } from "react-router";
import { CodeBadge, ErrorState, Pill } from "../components/ui";
import { useAuth } from "../features/auth";
import { useRealtime } from "../features/realtime";
import { authRequest } from "../lib/api";
import { PLACE_PHOTOS } from "../lib/photos";
import { PalaceArt } from "../components/PalaceArt";
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
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-5 text-white shadow-lg sm:p-6">
        <PalaceArt className="pointer-events-none absolute -bottom-6 -right-10 w-72 text-white/15" />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-500 text-2xl font-bold text-brand-900 shadow-lg ring-4 ring-white/20">
            {user.fullName.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold">{user.fullName}</p>
            <p className="text-sm text-white/70">{user.email}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-white/70">
              {t("memberSince")} {fmt.format(new Date(user.createdAt))}
              {connected && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 text-white">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                  </span>
                  {t("online")}
                </span>
              )}
            </p>
          </div>
          <button onClick={() => void logout()} className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 px-4 py-2 text-sm font-medium transition hover:bg-white/10">
            <LogOut size={15} /> {t("logout")}
          </button>
        </div>
        {visits.data && (
          <div className="relative mt-5 inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-sm">
            <Headphones size={16} /> <span className="text-lg font-semibold tabular-nums">{visits.data.pages[0]?.total ?? 0}</span> {t("listens")}
          </div>
        )}
      </section>

      {myTour.data?.tour && (
        <Link to={`/tour/${myTour.data.tour.code}`} className="flex animate-fade-up items-center justify-between gap-3 rounded-2xl border border-gold-500 bg-amber-50 p-4 transition hover:bg-amber-100">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500 text-white">
            <Flag size={18} />
          </span>
          <span className="min-w-0 flex-1">
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
        {visits.isPending && (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skeleton h-[74px]" />
            ))}
          </div>
        )}
        {visits.data && items.length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-center text-stone-500">
            {t("noHistory")}{" "}
            <Link to="/places" className="font-semibold text-brand-700 hover:underline">
              {t("allPlaces")} →
            </Link>
          </p>
        )}
        <ul className="space-y-2">
          {items.map((v, i) => (
            <li key={v.id} style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }} className="animate-fade-up">
              <Link
                to={`/p/${v.placeCode}`}
                state={{ from: "list" }}
                className="group flex items-center gap-3 rounded-2xl border bg-white p-3 transition hover:-translate-y-0.5 hover:border-brand-600 hover:shadow-md"
              >
                {PLACE_PHOTOS[v.placeCode] ? (
                  <img src={PLACE_PHOTOS[v.placeCode]!.src} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                ) : (
                  <CodeBadge code={v.placeCode} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{v.title}</span>
                  <span className="flex flex-wrap items-center gap-1 text-xs text-stone-500">
                    <Clock size={12} /> {fmt.format(new Date(v.startedAt))} · {v.lang.toUpperCase()} · {t("listenedFor")} {Math.floor(v.listenedSec / 60)}:{String(v.listenedSec % 60).padStart(2, "0")}
                  </span>
                </span>
                {v.completed && (
                  <Pill tone="brand">
                    <CheckCircle2 size={12} /> {t("completed")}
                  </Pill>
                )}
                <ChevronRight size={18} className="shrink-0 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-brand-700" />
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
