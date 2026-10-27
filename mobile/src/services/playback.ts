import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Speech from "expo-speech";
import type { NarrationItem, PlaybackEngine, PlaybackHandlers } from "../core/narration";

// Âm thanh vẫn phát khi khóa màn hình, tạm dừng khi có cuộc gọi (PRD v1.0, FE-07).
export async function configureAudio(): Promise<void> {
  await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: "doNotMix" });
}

// Phát tệp âm thanh (đã tải về máy hoặc stream từ máy chủ, tua được nhờ HTTP Range).
export class AudioFileEngine implements PlaybackEngine {
  readonly kind = "audio" as const;
  private player: AudioPlayer | null = null;

  start(item: NarrationItem, rate: number, h: PlaybackHandlers): void {
    const player = createAudioPlayer(item.audioUri!, { updateInterval: 500 });
    this.player = player;
    let ended = false;
    let loaded = false;
    // Không tải được tệp (mất mạng, sai địa chỉ) sau 10 giây → báo lỗi để controller hiện văn bản.
    const timer = setTimeout(() => {
      if (!loaded && this.player === player) h.onError("AUDIO_LOAD_FAILED");
    }, 10_000);
    player.addListener("playbackStatusUpdate", (s) => {
      if (s.isLoaded && !loaded) {
        loaded = true;
        clearTimeout(timer);
      }
      if (s.isLoaded) h.onProgress(s.currentTime, s.duration);
      if (s.didJustFinish && !ended) {
        ended = true;
        h.onEnd();
      }
    });
    player.setPlaybackRate(rate);
    player.play();
  }

  pause(): void {
    this.player?.pause();
  }

  resume(): void {
    this.player?.play();
  }

  stop(): void {
    this.player?.pause();
    this.player?.remove();
    this.player = null;
  }

  seekBy(deltaSec: number): void {
    const p = this.player;
    if (!p) return;
    void p.seekTo(Math.max(0, Math.min(p.duration || 0, p.currentTime + deltaSec)));
  }

  setRate(rate: number): void {
    this.player?.setPlaybackRate(rate);
  }
}

// Ước lượng thời lượng giọng đọc để hiện thanh tiến trình (≈ 14 ký tự/giây ở tốc độ 1×).
const CHARS_PER_SEC = 14;

// Giọng tổng hợp (expo-speech) khi điểm chưa có tệp âm thanh. Android không hỗ trợ tạm dừng giọng đọc
// nên "tạm dừng" = dừng và nhớ vị trí; "tiếp tục" đọc lại từ câu đang dở.
export class TtsEngine implements PlaybackEngine {
  readonly kind = "tts" as const;
  private sentences: string[] = [];
  private index = 0;
  private elapsed = 0;
  private tick: ReturnType<typeof setInterval> | null = null;
  private handlers: PlaybackHandlers | null = null;
  private item: NarrationItem | null = null;
  private rate = 1;
  private token = 0;

  start(item: NarrationItem, rate: number, h: PlaybackHandlers): void {
    this.item = item;
    this.handlers = h;
    this.rate = rate;
    this.sentences = item.text.split(/(?<=[.!?。！？])\s*/u).filter((s) => s.trim() !== "");
    this.index = 0;
    this.elapsed = 0;
    this.speakFrom(this.index);
  }

  private get duration(): number {
    return Math.max(1, Math.round((this.item?.text.length ?? 0) / CHARS_PER_SEC / this.rate));
  }

  private speakFrom(index: number): void {
    const token = ++this.token;
    const item = this.item!;
    const h = this.handlers!;
    this.startTick();
    const speakOne = (i: number) => {
      if (token !== this.token) return;
      const sentence = this.sentences[i];
      if (sentence === undefined) {
        this.stopTick();
        h.onProgress(this.duration, this.duration);
        h.onEnd();
        return;
      }
      this.index = i;
      Speech.speak(sentence, {
        language: item.ttsLocale,
        rate: this.rate,
        onDone: () => speakOne(i + 1),
        onError: () => {
          if (token !== this.token) return;
          this.stopTick();
          h.onError("NO_VOICE");
        },
      });
    };
    speakOne(index);
  }

  private startTick(): void {
    this.stopTick();
    this.tick = setInterval(() => {
      this.elapsed = Math.min(this.elapsed + 0.5, this.duration);
      this.handlers?.onProgress(this.elapsed, this.duration);
    }, 500);
  }

  private stopTick(): void {
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
  }

  pause(): void {
    this.token++;
    this.stopTick();
    void Speech.stop();
  }

  resume(): void {
    this.speakFrom(this.index);
  }

  stop(): void {
    this.token++;
    this.stopTick();
    void Speech.stop();
  }

  setRate(rate: number): void {
    this.rate = rate;
    if (this.tick) {
      this.pause();
      this.resume();
    }
  }
}

export function createEngine(item: NarrationItem): PlaybackEngine {
  return item.audioUri ? new AudioFileEngine() : new TtsEngine();
}
