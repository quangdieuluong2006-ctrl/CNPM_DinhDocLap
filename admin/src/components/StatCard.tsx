import type { ReactNode } from "react";

export function StatCard(props: { label: string; value: number | string; hint?: ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-5 shadow-sm ${props.highlight ? "border-emerald-300 ring-1 ring-emerald-200" : ""}`}>
      <p className="text-sm text-slate-500">{props.label}</p>
      <p className={`mt-2 text-3xl font-semibold ${props.highlight ? "text-emerald-700" : "text-slate-900"}`}>{props.value}</p>
      {props.hint && <div className="mt-1 text-xs text-slate-500">{props.hint}</div>}
    </div>
  );
}
