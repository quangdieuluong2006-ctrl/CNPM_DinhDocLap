import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useParams } from "react-router";
import { CodeBadge, ErrorState, Pill } from "../components/ui";
import { useAuth } from "../features/auth";
import { useRealtime } from "../features/realtime";
import { ApiError, authRequest } from "../lib/api";
import type { TKey } from "../lib/i18n";
import { usePrefs } from "../lib/prefs";
import { usePlaces } from "../lib/queries";

interface Tour {
  id: number;
  code: string;
  name: string;
  guide: { id: number; fullName: string };
  status: "active" | "ended";
  maxMembers: number;
  memberCount: number;
}

interface Member {
  userId: number;
  fullName: string;
  isGuide: boolean;
  online: boolean;
  currentPlaceId: number | null;
  currentPlaceCode: string | null;
}

const ERROR_KEY: Record<string, TKey> = {
  TOUR_NOT_FOUND: "tourNotFound",
  TOUR_ENDED: "tourEnded",
  TOUR_FULL: "tourFull",
  ALREADY_IN_TOUR: "tourOther",
};

// FE-16: /tour/:code – đích của mã QR nhóm do hướng dẫn viên chia sẻ. Xem tên nhóm, hướng dẫn viên → Tham gia
// → danh sách thành viên cập nhật theo thời gian thực (sự kiện tour.member.* của Socket.IO, PRD mục 12).
export function TourPage() {
  const { code = "" } = useParams();
  const { lang, t } = usePrefs();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { socket, connected } = useRealtime();
  const places = usePlaces(lang);

  const tour = useQuery({ queryKey: ["tour", code], queryFn: () => authRequest<Tour>(`/tours/${encodeURIComponent(code)}`) });
  const mine = useQuery({ queryKey: ["me", "tour"], queryFn: () => authRequest<{ tour: Tour | null }>("/me/tour") });
  const isMember = !!tour.data && mine.data?.tour?.id === tour.data.id;
  const members = useQuery({
    queryKey: ["tour", code, "members"],
    queryFn: () => authRequest<{ members: Member[] }>(`/tours/${tour.data!.id}/members`),
    enabled: isMember,
    // Mất Socket.IO → tải lại mỗi 10 giây (PRD mục 12)
    refetchInterval: connected ? false : 10_000,
  });

  useEffect(() => {
    if (!socket || !isMember) return;
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: ["tour", code] });
      void qc.invalidateQueries({ queryKey: ["me", "tour"] });
    };
    const events = ["tour.member.joined", "tour.member.left", "tour.member.updated", "tour.ended"];
    for (const e of events) socket.on(e, refresh);
    return () => {
      for (const e of events) socket.off(e, refresh);
    };
  }, [socket, isMember, qc, code]);

  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: ["tour", code] });
    void qc.invalidateQueries({ queryKey: ["me", "tour"] });
  };
  const join = useMutation({ mutationFn: () => authRequest(`/tours/${encodeURIComponent(code)}/join`, { method: "POST" }), onSuccess: refreshAll });
  const leave = useMutation({ mutationFn: (id: number) => authRequest(`/tours/${id}/leave`, { method: "POST" }), onSuccess: refreshAll });
  const switchTour = useMutation({
    mutationFn: async (oldId: number) => {
      await authRequest(`/tours/${oldId}/leave`, { method: "POST" });
      await authRequest(`/tours/${encodeURIComponent(code)}/join`, { method: "POST" });
    },
    onSuccess: refreshAll,
  });
  const end = useMutation({ mutationFn: (id: number) => authRequest(`/tours/${id}/end`, { method: "POST" }), onSuccess: refreshAll });

  if (tour.isPending) return <p className="text-stone-500">{t("loading")}</p>;
  if (tour.isError) {
    const key = tour.error instanceof ApiError ? ERROR_KEY[tour.error.code] : undefined;
    return key ? (
      <div className="space-y-3">
        <p className="text-lg font-semibold">{t(key)}</p>
        <Link to="/tour" className="font-semibold text-brand-700 hover:underline">
          {t("tourBack")}
        </Link>
      </div>
    ) : (
      <ErrorState message={t("error")} onRetry={() => void tour.refetch()} retryLabel={t("retry")} />
    );
  }

  const tr = tour.data;
  const joinError = join.error instanceof ApiError ? join.error.code : null;
  const other = mine.data?.tour && !isMember ? mine.data.tour : null;
  // Hướng dẫn viên của nhóm hoặc quản trị viên được kết thúc nhóm (API trả 403 với người khác)
  const canEnd = tr.status === "active" && (tr.guide.id === user?.id || user?.role === "admin");
  const titleOf = (placeId: number | null) => places.data?.find((p) => p.id === placeId)?.content?.title;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="relative isolate overflow-hidden rounded-2xl border bg-white p-5 shadow-sm">
        <div className="absolute -right-10 -top-10 -z-10 h-32 w-32 rounded-full bg-brand-50" />
        <p className="relative text-xs font-bold uppercase tracking-wider text-stone-500">{t("tour")}</p>
        <h1 className="mt-1 text-2xl font-bold">{tr.name}</h1>
        <p className="mt-1 text-stone-600">
          {t("tourGuide")}: <span className="font-medium">{tr.guide.fullName}</span> · {t("tourMembers")}: {tr.memberCount}/{tr.maxMembers}
        </p>
        <p className="mt-2 inline-block rounded-lg bg-brand-50 px-3 py-1 font-mono text-lg font-bold tracking-[0.3em] text-brand-800">{tr.code}</p>
        <p className="mt-3 text-sm text-stone-500">🔒 {t("tourPrivacy")}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {tr.status === "ended" ? (
            <>
              <Pill>{t("tourEnded")}</Pill>
              <Link to="/tour" className="text-sm font-semibold text-brand-700 hover:underline">
                {t("tourBack")}
              </Link>
            </>
          ) : isMember ? (
            <>
              <Pill tone="brand">✓ {t("tourJoined")}</Pill>
              <button onClick={() => leave.mutate(tr.id)} disabled={leave.isPending} className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-stone-50">
                {t("tourLeave")}
              </button>
            </>
          ) : other ? (
            <div className="w-full space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <p>
                {t("tourOther")}: <span className="font-semibold">{other.name}</span> ({other.code})
              </p>
              <button onClick={() => switchTour.mutate(other.id)} disabled={switchTour.isPending} className="rounded-xl bg-brand-700 px-4 py-2 font-semibold text-white hover:bg-brand-800">
                {t("tourSwitch")}
              </button>
            </div>
          ) : (
            <button onClick={() => join.mutate()} disabled={join.isPending} className="rounded-xl bg-brand-700 px-5 py-2.5 font-semibold text-white hover:bg-brand-800">
              {t("tourJoin")}
            </button>
          )}
        </div>
        {joinError && <p className="mt-2 text-sm text-red-700">{t(ERROR_KEY[joinError] ?? "error")}</p>}

        {canEnd && (
          <div className="mt-4 space-y-2 border-t pt-4 text-sm">
            <p className="text-stone-600">{t("tourShareHint")}</p>
            <p className="break-all rounded-lg bg-stone-50 px-3 py-2 font-mono text-brand-800">{`${window.location.origin}/tour/${tr.code}`}</p>
            <button
              onClick={() => window.confirm(t("tourEndConfirm")) && end.mutate(tr.id)}
              disabled={end.isPending}
              className="rounded-xl border border-red-300 px-4 py-2 font-medium text-red-700 hover:bg-red-50"
            >
              {t("tourEnd")}
            </button>
            {end.isError && <p className="text-red-700">{t("error")}</p>}
          </div>
        )}
      </section>

      {isMember && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t("tourMembers")}</h2>
          <ul className="divide-y rounded-2xl border bg-white">
            {members.data?.members.map((m) => (
              <li key={m.userId} className="flex animate-fade-up items-center gap-3 px-4 py-3">
                <span className="relative shrink-0">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold text-white ${m.isGuide ? "bg-gold-500" : "bg-brand-700"}`}>
                    {m.fullName.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white ${m.online ? "bg-emerald-500" : "bg-stone-300"}`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{m.fullName}</span> {m.isGuide && <Pill tone="gold">{t("tourGuide")}</Pill>}
                  <span className="block text-sm text-stone-500">
                    {m.currentPlaceCode ? (
                      <Link to={`/p/${m.currentPlaceCode}`} state={{ from: "list" }} className="hover:underline">
                        {t("tourListening")} {m.currentPlaceCode} · {titleOf(m.currentPlaceId) ?? ""}
                      </Link>
                    ) : !m.online ? (
                      t("tourOffline")
                    ) : null}
                  </span>
                </span>
                {m.currentPlaceCode && <CodeBadge code={m.currentPlaceCode} />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
