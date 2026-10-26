import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useCountUp } from "../lib/useCountUp";

const TONES = {
  emerald: "bg-emerald-100 text-emerald-700",
  sky: "bg-sky-100 text-sky-700",
  amber: "bg-amber-100 text-amber-700",
  violet: "bg-violet-100 text-violet-700",
  rose: "bg-rose-100 text-rose-700",
  teal: "bg-teal-100 text-teal-700",
} as const;

export function StatCard(props: {
  label: string;
  value: number;
  hint?: ReactNode;
  highlight?: boolean;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  delayMs?: number;
}) {
  const shown = useCountUp(props.value);
  const Icon = props.icon;
  return (
    <div
      style={{ animationDelay: `${props.delayMs ?? 0}ms` }}
      className={`group relative h-full animate-fade-up overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        props.highlight ? "border-emerald-300 ring-1 ring-emerald-200" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{props.label}</p>
          <p className={`mt-2 text-3xl font-semibold tabular-nums ${props.highlight ? "text-emerald-700" : "text-slate-900"}`}>{shown}</p>
        </div>
        <span className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 ${TONES[props.tone ?? "emerald"]}`}>
          {props.highlight && props.value > 0 && <span className="absolute inset-0 animate-ping rounded-xl bg-emerald-300/50" />}
          <Icon size={22} className="relative" />
        </span>
      </div>
      {props.hint && <div className="mt-1 text-xs text-slate-500">{props.hint}</div>}
    </div>
  );
}
