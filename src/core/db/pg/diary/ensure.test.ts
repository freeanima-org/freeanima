import { describe, expect, test } from "bun:test";

import { cstCalendarDay, diaryDayKey, diaryEntryAtNoon, titleFromDiaryDay } from "./ensure.ts";

describe("diary ensure helpers", () => {
  test("diaryDayKey trims to YYYY-MM-DD", () => {
    expect(diaryDayKey("2026-07-17T12:00:00+08:00")).toBe("2026-07-17");
    expect(diaryDayKey(" 2026-07-17 ")).toBe("2026-07-17");
  });

  test("diaryEntryAtNoon builds CST noon", () => {
    expect(diaryEntryAtNoon("2026-07-17")).toBe("2026-07-17T12:00:00+08:00");
    expect(() => diaryEntryAtNoon("not-a-day")).toThrow(/invalid diary day/);
  });

  test("cstCalendarDay prefers CST calendar day", () => {
    expect(cstCalendarDay("2026-07-17")).toBe("2026-07-17");
    expect(cstCalendarDay(new Date("2026-07-16T16:00:00.000Z"))).toBe("2026-07-17");
  });

  test("titleFromDiaryDay returns zh-CN date string", () => {
    expect(titleFromDiaryDay("2026-07-17")).toContain("2026");
  });
});
