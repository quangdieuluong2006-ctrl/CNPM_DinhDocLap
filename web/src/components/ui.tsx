import { useEffect, type ReactNode } from "react";

export function Modal(props: { title: string; onClose: () => void; children: ReactNode; closeLabel?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-stone-900/50 sm:items-center sm:p-4" onClick={props.onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{props.title}</h2>
          <button onClick={props.onClose} aria-label={props.closeLabel ?? "Đóng"} className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
            ✕
          </button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

const TONES = {
  brand: "bg-brand-50 text-brand-800 ring-brand-100",
  gold: "bg-amber-50 text-amber-800 ring-amber-200",
  sky: "bg-sky-50 text-sky-800 ring-sky-200",
  stone: "bg-stone-100 text-stone-700 ring-stone-200",
} as const;

export function Pill(props: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[props.tone ?? "stone"]}`}>
      {props.children}
    </span>
  );
}

// Biển số điểm: hình tròn chứa 3 chữ số, giống biển in tại từng phòng và marker trên Mobile.
export function CodeBadge(props: { code: string; size?: "sm" | "lg" }) {
  const lg = props.size === "lg";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-700 font-bold text-white tabular-nums ${
        lg ? "h-14 w-14 text-lg" : "h-10 w-10 text-sm"
      }`}
    >
      {props.code}
    </span>
  );
}

export function ErrorState(props: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
      {props.message}{" "}
      {props.onRetry && (
        <button className="font-medium underline" onClick={props.onRetry}>
          {props.retryLabel ?? "Thử lại"}
        </button>
      )}
    </div>
  );
}
