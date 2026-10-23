import { usePrefs } from "../lib/prefs";
import { usePlayer, type PlayerSource } from "../lib/usePlayer";

const RATES = [0.75, 1, 1.25, 1.5];

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
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={playing ? pause : play}
          aria-label={playing ? t("pause") : t("listen")}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-700 text-2xl text-white shadow hover:bg-brand-800"
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {playing ? t("pause") : state.status === "paused" ? t("resume") : t("listen")}
            {!isAudio && <span className="ml-2 text-xs font-normal text-amber-700">· {t("tts")}</span>}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
            <div className="h-1.5 rounded-full bg-gold-600 transition-[width]" style={{ width: `${progress}%` }} />
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
            <button onClick={() => seek(-10)} className="rounded-full border px-3 py-1 hover:bg-stone-50">
              −10s
            </button>
            <button onClick={() => seek(10)} className="rounded-full border px-3 py-1 hover:bg-stone-50">
              +10s
            </button>
          </>
        )}
        <button onClick={replay} className="rounded-full border px-3 py-1 hover:bg-stone-50">
          ↺ {t("replay")}
        </button>
        <button onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length]!)} className="rounded-full border px-3 py-1 hover:bg-stone-50">
          {t("speed")} {rate}×
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
