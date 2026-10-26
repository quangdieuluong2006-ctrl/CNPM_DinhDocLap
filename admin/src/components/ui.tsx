import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function PageHeader(props: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{props.title}</h1>
        {props.subtitle && <p className="mt-1 text-sm text-slate-500">{props.subtitle}</p>}
      </div>
      {props.actions && <div className="flex flex-wrap items-center gap-2">{props.actions}</div>}
    </div>
  );
}

const TONES = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
} as const;

export function Badge(props: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[props.tone ?? "slate"]}`}>
      {props.children}
    </span>
  );
}

export function Button(props: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const v = props.variant ?? "secondary";
  const cls =
    v === "primary"
      ? "bg-emerald-700 text-white hover:bg-emerald-800"
      : v === "danger"
        ? "bg-red-600 text-white hover:bg-red-700"
        : "border bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className={`rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${cls} ${props.className ?? ""}`}
    >
      {props.children}
    </button>
  );
}

export function Modal(props: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);
  // Portal ra <body>: lớp phủ luôn che cả màn hình, không bị khung cha (hiệu ứng, overflow, z-index) giới hạn
  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 p-4" onClick={props.onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-6 shadow-xl ${props.wide ? "max-w-3xl" : "max-w-md"}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{props.title}</h2>
          <button onClick={props.onClose} aria-label="Đóng" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            ✕
          </button>
        </div>
        {props.children}
      </div>
    </div>,
    document.body,
  );
}

export function Pagination(props: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(props.total / props.pageSize));
  return (
    <div className="flex items-center justify-between text-sm text-slate-600">
      <span>
        Tổng {props.total} · Trang {props.page}/{pages}
      </span>
      <div className="flex gap-2">
        <Button disabled={props.page <= 1} onClick={() => props.onPage(props.page - 1)}>
          ‹ Trước
        </Button>
        <Button disabled={props.page >= pages} onClick={() => props.onPage(props.page + 1)}>
          Sau ›
        </Button>
      </div>
    </div>
  );
}

export function ErrorBox(props: { error: Error; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700">
      {props.error.message}{" "}
      {props.onRetry && (
        <button className="underline" onClick={props.onRetry}>
          Thử lại
        </button>
      )}
    </div>
  );
}

export const inputCls = "w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300";

export function Field(props: { label: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{props.label}</span>
      <div className="mt-1">{props.children}</div>
      {props.error ? <p className="mt-1 text-xs text-red-600">{props.error}</p> : props.hint ? <p className="mt-1 text-xs text-slate-500">{props.hint}</p> : null}
    </label>
  );
}
