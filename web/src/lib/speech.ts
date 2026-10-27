// Tách văn bản thành câu để đọc lần lượt bằng speechSynthesis: tạm dừng/tiếp tục theo câu
// (trình duyệt Android không hỗ trợ pause() ổn định) và tránh giới hạn độ dài một lần đọc.
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。！？])\s*/u)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

// Ước lượng thời lượng đọc (≈ 14 ký tự/giây ở tốc độ 1×) để hiện thanh tiến trình.
export function estimateSeconds(text: string, rate = 1): number {
  return Math.max(1, Math.round(text.length / 14 / rate));
}

// Tìm giọng của trình duyệt khớp ngôn ngữ (ja-JP → ja-JP, nếu không có thì ja-*).
export function findVoice(voices: SpeechSynthesisVoice[], locale: string): SpeechSynthesisVoice | undefined {
  const lower = locale.toLowerCase();
  const lang = lower.split("-")[0];
  return (
    voices.find((v) => v.lang.toLowerCase().replace("_", "-") === lower) ??
    voices.find((v) => v.lang.toLowerCase().split(/[-_]/)[0] === lang)
  );
}

export const COMPLETED_RATIO = 0.9; // nghe ≥ 90% = đã nghe hết (giống Mobile)
