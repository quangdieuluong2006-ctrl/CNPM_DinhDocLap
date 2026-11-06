import { describe, expect, it } from "vitest";
import { AI_VOICES, durationFromBytes, spokenText, textHash } from "../src/db/aiVoice.js";
import { seedTexts } from "../src/db/gen-audio.js";

describe("giọng đọc AI (PRD v2.0, mục 4.10)", () => {
  it("đọc tiêu đề rồi đến bài, tự thêm dấu chấm sau tiêu đề", () => {
    expect(spokenText({ title: " Cổng chính ", body: "Chào mừng bạn. " })).toBe("Cổng chính.\n\nChào mừng bạn.");
    expect(spokenText({ title: "大门。", body: "欢迎" })).toBe("大门。\n\n欢迎");
  });

  it("mã băm đổi khi sửa văn bản hoặc đổi giọng, không đổi khi chỉ khác khoảng trắng đầu/cuối", () => {
    const t = { title: "Xe tăng", body: "Trưa 30/4/1975" };
    const h = textHash("vi-VN-HoaiMyNeural", t);
    expect(textHash("vi-VN-HoaiMyNeural", { title: " Xe tăng", body: "Trưa 30/4/1975\n" })).toBe(h);
    expect(textHash("vi-VN-HoaiMyNeural", { ...t, body: "Trưa 30/4/1975." })).not.toBe(h);
    expect(textHash("vi-VN-NamMinhNeural", t)).not.toBe(h);
  });

  it("thời lượng tính từ số byte của MP3 48 kbps", () => {
    expect(durationFromBytes(237_168)).toBe(40); // ffprobe: 39,5 giây
    expect(durationFromBytes(10)).toBe(1);
  });

  it("dữ liệu mẫu: 12 điểm × 10 ngôn ngữ, ngôn ngữ nào cũng đã chọn giọng", () => {
    const items = seedTexts();
    expect(items).toHaveLength(120);
    expect(new Set(items.map((i) => i.lang))).toEqual(new Set(Object.keys(AI_VOICES)));
    for (const i of items) expect(i.text.title && i.text.body).toBeTruthy();
  });
});
