import { useCallback, useEffect, useRef, useState } from "react";
import { COMPLETED_RATIO, estimateSeconds, findVoice, splitSentences } from "./speech";

export interface PlayerSource {
  key: string; // đổi key (điểm/ngôn ngữ khác) → dừng bài cũ
  audioUrl: string | null;
  text: string;
  ttsLocale: string;
}

export interface PlayerState {
  status: "idle" | "playing" | "paused" | "ended";
  engine: "audio" | "tts";
  position: number;
  duration: number;
  error: "noVoice" | "audio" | null;
}

// Trình phát của Web User (PRD v1.0, FE-14): tệp âm thanh qua thẻ <audio>; không có tệp → Web Speech API.
// onFinish được gọi một lần cho mỗi lượt nghe (kết thúc, dừng, đổi bài hoặc rời trang) để ghi lượt ghé.
export function usePlayer(
  src: PlayerSource,
  onFinish: (listenedSec: number, completed: boolean, startedAt: string) => void,
  onStart?: () => void,
) {
  const engine: PlayerState["engine"] = src.audioUrl ? "audio" : "tts";
  const [state, setState] = useState<PlayerState>({ status: "idle", engine, position: 0, duration: 0, error: null });
  const [rate, setRateState] = useState(1);
  const audio = useRef<HTMLAudioElement | null>(null);
  const sentences = useRef<string[]>([]);
  const index = useRef(0);
  const token = useRef(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const session = useRef<{ startedAt: string; max: number; done: boolean } | null>(null);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const startRef = useRef(onStart);
  startRef.current = onStart;

  // Bắt đầu một lượt nghe mới (lần bấm phát đầu tiên, hoặc sau khi lượt trước đã kết thúc)
  const beginSession = () => {
    if (session.current && !session.current.done) return;
    session.current = { startedAt: new Date().toISOString(), max: 0, done: false };
    startRef.current?.();
  };

  const report = useCallback((ended: boolean, duration: number) => {
    const s = session.current;
    if (!s || s.done) return;
    s.done = true;
    const listened = Math.round(ended ? duration : s.max);
    finishRef.current(listened, ended || (duration > 0 && listened >= COMPLETED_RATIO * duration), s.startedAt);
  }, []);

  const stopTick = () => {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
  };

  const stopAll = useCallback(() => {
    token.current++;
    stopTick();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    audio.current?.pause();
  }, []);

  // Đổi bài (điểm khác, ngôn ngữ khác) hoặc rời trang: dừng và ghi lượt nghe của bài cũ
  useEffect(() => {
    setState({ status: "idle", engine, position: 0, duration: 0, error: null });
    return () => {
      const dur = audio.current?.duration || estimateSeconds(src.text);
      stopAll();
      report(false, Number.isFinite(dur) ? dur : 0);
      session.current = null;
      audio.current = null;
    };
  }, [src.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const speakFrom = useCallback(
    (i: number, r: number) => {
      const my = ++token.current;
      const voices = speechSynthesis.getVoices();
      const voice = findVoice(voices, src.ttsLocale);
      // Danh sách giọng đã tải mà không có giọng nào của ngôn ngữ này → báo để khách đọc văn bản
      if (voices.length > 0 && !voice) {
        setState((s) => ({ ...s, status: "idle", error: "noVoice" }));
        return;
      }
      const duration = estimateSeconds(src.text, r);
      stopTick();
      tick.current = setInterval(() => {
        setState((s) => {
          const position = Math.min(s.position + 0.5, duration);
          if (session.current) session.current.max = Math.max(session.current.max, position);
          return { ...s, position, duration };
        });
      }, 500);
      const speakOne = (k: number) => {
        if (my !== token.current) return;
        const sentence = sentences.current[k];
        if (sentence === undefined) {
          stopTick();
          setState((s) => ({ ...s, status: "ended", position: duration, duration }));
          report(true, duration);
          return;
        }
        index.current = k;
        const u = new SpeechSynthesisUtterance(sentence);
        u.lang = src.ttsLocale;
        try {
          if (voice) u.voice = voice;
        } catch {
          // một số trình duyệt từ chối đối tượng giọng – vẫn đọc bằng giọng mặc định theo u.lang
        }
        u.rate = r;
        u.onend = () => speakOne(k + 1);
        u.onerror = (e) => {
          if (my !== token.current || e.error === "interrupted" || e.error === "canceled") return;
          stopTick();
          setState((s) => ({ ...s, status: "idle", error: "noVoice" }));
        };
        speechSynthesis.speak(u);
      };
      speakOne(i);
    },
    [src.text, src.ttsLocale, report],
  );

  const play = useCallback(() => {
    beginSession();
    setState((s) => ({ ...s, status: "playing", error: null, position: s.status === "ended" ? 0 : s.position }));
    if (src.audioUrl) {
      let a = audio.current;
      if (!a) {
        a = new Audio(src.audioUrl);
        audio.current = a;
        a.ontimeupdate = () => {
          const el = audio.current;
          if (!el) return;
          if (session.current) session.current.max = Math.max(session.current.max, el.currentTime);
          setState((s) => ({ ...s, position: el.currentTime, duration: Number.isFinite(el.duration) ? el.duration : 0 }));
        };
        a.onended = () => {
          setState((s) => ({ ...s, status: "ended" }));
          report(true, a!.duration);
        };
        a.onerror = () => setState((s) => ({ ...s, status: "idle", error: "audio" }));
      }
      a.playbackRate = rate;
      if (a.ended) a.currentTime = 0;
      void a.play().catch(() => setState((s) => ({ ...s, status: "idle", error: "audio" })));
      return;
    }
    if (typeof speechSynthesis === "undefined") {
      setState((s) => ({ ...s, status: "idle", error: "noVoice" }));
      return;
    }
    if (sentences.current.length === 0 || state.status === "ended" || state.status === "idle") {
      sentences.current = splitSentences(src.text);
      index.current = 0;
      setState((s) => ({ ...s, position: 0 }));
    }
    speakFrom(index.current, rate);
  }, [src.audioUrl, src.text, rate, report, speakFrom, state.status]);

  const pause = useCallback(() => {
    if (src.audioUrl) audio.current?.pause();
    else stopAll();
    setState((s) => ({ ...s, status: "paused" }));
  }, [src.audioUrl, stopAll]);

  // Nghe lại từ đầu: tệp âm thanh tua về 0; giọng tổng hợp đọc lại từ câu đầu
  const replay = useCallback(() => {
    beginSession();
    setState((s) => ({ ...s, status: "playing", position: 0, error: null }));
    const a = audio.current;
    if (a) {
      a.currentTime = 0;
      void a.play().catch(() => setState((s) => ({ ...s, status: "idle", error: "audio" })));
      return;
    }
    if (src.audioUrl) {
      play();
      return;
    }
    stopAll();
    sentences.current = splitSentences(src.text);
    index.current = 0;
    speakFrom(0, rate);
  }, [src.audioUrl, src.text, rate, play, speakFrom, stopAll]);

  const seek = useCallback((delta: number) => {
    const a = audio.current;
    if (a) a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + delta));
  }, []);

  const setRate = useCallback(
    (r: number) => {
      setRateState(r);
      if (audio.current) audio.current.playbackRate = r;
      else if (state.status === "playing") speakFrom(index.current, r);
    },
    [speakFrom, state.status],
  );

  return { state, rate, play, pause, replay, seek, setRate };
}
