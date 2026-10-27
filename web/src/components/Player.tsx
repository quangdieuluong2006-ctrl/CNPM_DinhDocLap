import { Gauge, Pause, Play, RotateCcw, RotateCw, Undo2 } from "lucide-react";
import { usePrefs } from "../lib/prefs";
import { usePlayer, type PlayerSource } from "../lib/usePlayer";

const RATES = [0.75, 1, 1.25, 1.5];

// Sóng âm nhảy khi đang phát; dừng lại (thấp, mờ) khi tạm dừng
function Equalizer(props: { active: boolean }) {
  return (
    <span className="flex h-5 items-end gap-0.5" aria-hidden="true">
      {[0, 180, 360, 90, 270].map((d) => (
        <span
          key={d}
          style={{ animationDelay: `${d}ms` }}
          className={`w-1 origin-bottom rounded-full bg-gold-600 ${props.active ? "h-5 animate-eq" : "h-1.5 opacity-40"}`}
        />
      ))}
    </span>
  );
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Trình phát trên trang chi tiết điểm (FE-14): phát/tạm dừng, nghe lại, tốc độ; tua ±10 giây khi có tệp âm thanh.
export function Player(props: {
  source: PlayerSource;
  onFinish: (listenedSec: number, completed: boolean, startedAt: string) => void;
  onStart?: () => void;
}) {
  const { t } = usePrefs();
  const { state, rate, play, pause, replay, seek, setRate } = usePlayer(props.source, props.onFinish, props.onStart);
  const isAudio = state.engine === "audio";
  const progress = state.duration > 0 ? Math.min(100, (state.position / state.duration) * 100) : 0;
  const playing = state.status === "playing";

  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm transition ${playing ? "border-brand-600 shadow-md" : ""}`}>
      <div className="flex items-center gap-4">
        <button
          onClick={playing ? pause : play}
          aria-label={playing ? t("pause") : t("listen")}
          className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white shadow-lg shadow-brand-700/30 transition hover:scale-105 hover:bg-brand-800 active:scale-95"
        >
          {playing && <span className="absolute inset-0 animate-ping rounded-full bg-brand-600/40" />}
          {playing ? <Pause size={24} fill="currentColor" className="relative" /> : <Play size={24} fill="currentColor" className="relative ml-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold">
            {playing ? t("nowPlaying") : state.status === "paused" ? t("resume") : t("listen")}
            {!isAudio && <span className="text-xs font-normal text-amber-700">· {t("tts")}</span>}
            <span className="ml-auto">
              <Equalizer active={playing} />
            </span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
            <div className="h-1.5 rounded-full bg-gradient-to-r from-gold-500 to-gold-600 transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-xs text-stone-500 tabular-nums">
            <span>{fmt(state.position)}</span>
            <span>{state.duration ? fmt(state.duration) : "–:–"}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {isAudio && (
          <>
            <button onClick={() => seek(-10)} aria-label="−10s" className="inline-flex items-center gap-1 rounded-full border px-3 py-1 transition hover:border-brand-600 hover:bg-brand-50">
              <RotateCcw size={14} /> 10s
            </button>
            <button onClick={() => seek(10)} aria-label="+10s" className="inline-flex items-center gap-1 rounded-full border px-3 py-1 transition hover:border-brand-600 hover:bg-brand-50">
              <RotateCw size={14} /> 10s
            </button>
          </>
        )}
        <button onClick={replay} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 transition hover:border-brand-600 hover:bg-brand-50">
          <Undo2 size={14} /> {t("replay")}
        </button>
        <button onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length]!)} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 transition hover:border-brand-600 hover:bg-brand-50">
          <Gauge size={14} /> {t("speed")} {rate}×
        </button>
      </div>
      {state.error && (
        <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {state.error === "noVoice" ? t("noVoice") : t("audioError")}
        </p>
      )}
    </div>
  );
}
