import { describe, expect, it } from "vitest";
import { estimateSeconds, findVoice, splitSentences } from "../src/lib/speech";

const voice = (lang: string, name = lang) => ({ lang, name }) as SpeechSynthesisVoice;

describe("giọng đọc tổng hợp (FE-14)", () => {
  it("tách câu theo dấu câu tiếng Việt, tiếng Anh và tiếng Nhật", () => {
    expect(splitSentences("Chào bạn. Đây là cổng chính! Bạn sẵn sàng chưa?")).toEqual(["Chào bạn.", "Đây là cổng chính!", "Bạn sẵn sàng chưa?"]);
    expect(splitSentences("正門です。戦車が入りました。")).toEqual(["正門です。", "戦車が入りました。"]);
    expect(splitSentences("  ")).toEqual([]);
  });

  it("chọn giọng đúng vùng, không có thì cùng ngôn ngữ, không có nữa thì undefined", () => {
    const voices = [voice("en-US"), voice("vi-VN"), voice("ja_JP")];
    expect(findVoice(voices, "vi-VN")?.lang).toBe("vi-VN");
    expect(findVoice(voices, "en-GB")?.lang).toBe("en-US");
    expect(findVoice(voices, "ja-JP")?.lang).toBe("ja_JP");
    expect(findVoice(voices, "th-TH")).toBeUndefined();
  });

  it("ước lượng thời lượng theo độ dài và tốc độ", () => {
    expect(estimateSeconds("a".repeat(140))).toBe(10);
    expect(estimateSeconds("a".repeat(140), 2)).toBe(5);
    expect(estimateSeconds("")).toBe(1);
  });
});
