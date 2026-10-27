import { describe, expect, it } from "vitest";
import { DICTS, translator, uiLocaleFor, UI_LOCALES } from "../src/i18n";

describe("giao diện đủ 10 ngôn ngữ", () => {
  const keys = Object.keys(DICTS.vi);

  it.each(UI_LOCALES)("%s có đủ mọi câu, không câu nào bỏ trống", (locale) => {
    const dict = DICTS[locale] as Record<string, string>;
    expect(Object.keys(dict).sort()).toEqual([...keys].sort());
    for (const k of keys) expect(dict[k]?.trim(), `${locale}.${k}`).toBeTruthy();
  });

  it("giao diện đi theo ngôn ngữ thuyết minh", () => {
    expect(translator(uiLocaleFor("ja"))("listen")).toBe("聴く");
  });

  it("ngôn ngữ chưa có bản dịch giao diện → tiếng Anh", () => {
    expect(uiLocaleFor("it")).toBe("en");
  });
});
