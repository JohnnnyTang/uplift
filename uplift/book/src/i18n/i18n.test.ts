import { afterEach, describe, expect, it, vi } from "vitest";
import {
  uValleyLesson,
  uValleyPage,
  uValleyDeeperText,
  uValleyTeacherNotes,
  platesLesson,
  platesPage,
  platesDeeperText,
  platesTeacherNotes,
} from "@uplift/spreads";
import { LESSON_ZH } from "./lesson-zh";
import { UI_ZH } from "./ui-zh";
import {
  getLanguage,
  initializeLanguage,
  localizeUnits,
  onLanguageChange,
  setLanguage,
  translate,
} from "./index";

function levelCopy(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  if ("hs" in object && "uni" in object) {
    return [object.hs, object.uni].flatMap((v) =>
      typeof v === "string"
        ? [v]
        : Array.isArray(v)
          ? v.filter((s): s is string => typeof s === "string")
          : [],
    );
  }
  return Object.values(object).flatMap(levelCopy);
}
afterEach(() => {
  vi.unstubAllGlobals();
  setLanguage("en");
});

describe("initial reader language", () => {
  it.each([
    ["zh-CN", null, "zh-CN"],
    ["zh-CN", "en", "en"],
    ["zh-CN", "invalid", "zh-CN"],
    ["en", null, "en"],
    ["en", "zh-CN", "zh-CN"],
  ])("uses document language %s with saved preference %s → %s", (lang, saved, expected) => {
    const documentElement = { lang };
    vi.stubGlobal("document", { documentElement });
    vi.stubGlobal("localStorage", { getItem: () => saved });

    initializeLanguage();

    expect(getLanguage()).toBe(expected);
    expect(documentElement.lang).toBe(expected);
  });
});

describe("two-lesson Chinese copy", () => {
  it("covers every authored level text, disclosure and complete reader markdown", () => {
    const copy = [
      ...levelCopy(uValleyLesson),
      ...levelCopy(platesLesson),
      ...levelCopy(uValleyPage),
      ...levelCopy(platesPage),
      uValleyDeeperText,
      uValleyTeacherNotes,
      platesDeeperText,
      platesTeacherNotes,
    ];
    const missing = [...new Set(copy)].filter((source) => source.trim() && !LESSON_ZH[source.trim()]);
    expect(missing).toEqual([]);
  });
  it("keeps every live binding token in translated scientific copy", () => {
    const tokens = (s: string) => [...s.matchAll(/\{\{[^}]+\}\}/g)].map((m) => m[0]).sort();
    for (const [english, chinese] of Object.entries(LESSON_ZH)) {
      expect(tokens(chinese), english).toEqual(tokens(english));
      expect(chinese.trim(), english).not.toBe("");
    }
  });
  it("leaves English text and citation addresses unchanged", () => {
    for (const source of [...Object.keys(LESSON_ZH), ...Object.keys(UI_ZH)])
      expect(translate(source)).toBe(source);
    setLanguage("zh-CN");
    expect(translate("https://www.nps.gov/yose/learn/nature/geology.htm")).toBe(
      "https://www.nps.gov/yose/learn/nature/geology.htm",
    );
  });
  it("localizes dynamic scene values without changing the numbers", () => {
    setLanguage("zh-CN");
    expect(translate("model time 0.15 model years")).toBe("模型时间 0.15 模型年");
    expect(translate("sandstone")).toBe("砂岩");
    expect(translate("Read question and explanation ↗")).toBe("阅读问题与解释 ↗");
    expect(localizeUnits("最陡谷壁 26 degrees；时间 0.15 model years")).toBe(
      "最陡谷壁 26 度；时间 0.15 模型年",
    );
    expect(translate("Lesson 2 · Plate tectonics")).toBe("第 2 课 · 板块构造");
  });
  it("unsubscribes language listeners and round trips without retaining Chinese", () => {
    let changes = 0;
    const stop = onLanguageChange(() => changes++);
    setLanguage("zh-CN");
    expect(getLanguage()).toBe("zh-CN");
    expect(translate("Where plates meet")).toBe("板块相遇的地方");
    setLanguage("en");
    expect(translate("Where plates meet")).toBe("Where plates meet");
    expect(changes).toBe(2);
    stop();
    setLanguage("zh-CN");
    expect(changes).toBe(2);
  });
});
