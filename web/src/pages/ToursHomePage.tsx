import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ErrorState } from "../components/ui";
import { useAuth } from "../features/auth";
import { ApiError, authRequest } from "../lib/api";
import { normalizeTourCode } from "../lib/tour";
import { usePrefs } from "../lib/prefs";

// FE-16: /tour – cửa vào nhóm tham quan từ menu. Khách nhập mã 6 ký tự → /tour/:code (xem nhóm rồi bấm Tham gia);
// hướng dẫn viên / quản trị viên tạo nhóm mới (POST /tours) và nhận mã để chia sẻ.
export function ToursHomePage() {
  const { status, user } = useAuth();
  const { t } = usePrefs();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const mine = useQuery({
    queryKey: ["me", "tour"],
    queryFn: () => authRequest<{ tour: { code: string; name: string } | null }>("/me/tour"),
    enabled: status === "authenticated",
  });
  const create = useMutation({
    mutationFn: () => authRequest<{ code: string }>("/tours", { method: "POST", body: { name: name.trim() } }),
    onSuccess: (tour) => void navigate(`/tour/${tour.code}`),
  });

  if (status === "loading") return <p className="text-stone-500">{t("loading")}</p>;
  if (status === "guest") {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-bold">{t("tour")}</h1>
        <p className="text-stone-600">{t("tourHubIntro")}</p>
        <Link to="/login" state={{ from: "/tour" }} className="inline-block rounded-xl bg-brand-700 px-5 py-2.5 font-semibold text-white hover:bg-brand-800">
          {t("tourLogin")}
        </Link>
      </div>
    );
  }

  const ready = code.length === 6;
  const join = (e: FormEvent) => {
    e.preventDefault();
    if (ready) void navigate(`/tour/${code}`);
  };
  const submitCreate = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate();
  };
  const current = mine.data?.tour;
  const canCreate = user?.role === "guide" || user?.role === "admin";
  const createError = create.error instanceof ApiError && create.error.code === "ALREADY_IN_TOUR" ? t("tourOther") : create.error ? t("error") : null;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t("tour")}</h1>
        <p className="mt-1 text-stone-600">{t("tourHubIntro")}</p>
      </div>

      {mine.isError && <ErrorState message={t("error")} onRetry={() => void mine.refetch()} retryLabel={t("retry")} />}
      {current && (
        <Link to={`/tour/${current.code}`} className="flex items-center justify-between rounded-2xl border border-gold-500 bg-amber-50 p-4 hover:bg-amber-100">
          <span>
            <span className="block text-xs font-bold uppercase tracking-wider text-amber-800">{t("myTour")}</span>
            <span className="font-semibold">{current.name}</span> <span className="font-mono text-sm">({current.code})</span>
          </span>
          <span className="font-semibold text-brand-700">{t("open")} →</span>
        </Link>
      )}

      <form onSubmit={join} className="space-y-3 rounded-2xl border bg-white p-5 shadow-sm">
        <label htmlFor="tour-code" className="block font-semibold">
          {t("tourCodeLabel")}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="tour-code"
            value={code}
            onChange={(e) => setCode(normalizeTourCode(e.target.value))}
            placeholder="• • • • • •"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="w-44 rounded-xl border px-4 py-2.5 text-center font-mono text-xl tracking-[0.3em] uppercase"
          />
          <button type="submit" disabled={!ready} className="rounded-xl bg-brand-700 px-5 py-2.5 font-semibold text-white hover:bg-brand-800 disabled:opacity-40">
            {t("tourFind")}
          </button>
        </div>
        <p className="text-sm text-stone-500">{t("tourCodeHint")}</p>
      </form>

      {canCreate && (
        <form onSubmit={submitCreate} className="space-y-3 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold">{t("tourCreateTitle")}</h2>
          {current ? (
            <p className="text-sm text-stone-500">{t("tourCreateBusy")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder={t("tourName")}
                className="min-w-0 flex-1 rounded-xl border px-4 py-2.5"
              />
              <button type="submit" disabled={!name.trim() || create.isPending} className="rounded-xl bg-brand-700 px-5 py-2.5 font-semibold text-white hover:bg-brand-800 disabled:opacity-40">
                {t("tourCreate")}
              </button>
            </div>
          )}
          {createError && <p className="text-sm text-red-700">{createError}</p>}
        </form>
      )}
    </div>
  );
}
