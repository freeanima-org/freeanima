import { describe, expect, test } from "bun:test";

import {
  dedupeBuiltinItemsByDateTitle,
  expandBuiltinSourceYear,
  expandCnHolidayYear,
  expandInternationalYear,
  expandSolarTermYear,
  expandTraditionalYear,
  filterBuiltinItemsByDateRange,
  listBuiltinCalendarSources,
  yearsOverlappingRange,
} from "./builtin-calendar-sources.ts";

describe("builtin-calendar-sources", () => {
  test("listBuiltinCalendarSources 含四源", () => {
    expect(listBuiltinCalendarSources().map((s) => s.id)).toEqual([
      "cn_holiday",
      "traditional",
      "international",
      "solar_term",
    ]);
  });

  test("中国节假日 2026：国庆仅一日且无调休碎条", () => {
    const items = expandCnHolidayYear(2026);
    const guoqing = items.filter((i) => i.title === "国庆节");
    expect(guoqing).toHaveLength(1);
    expect(guoqing[0]?.date).toBe("2026-10-01");

    const titles = new Set(items.map((i) => i.title));
    expect(titles.has("元旦")).toBe(true);
    expect(titles.has("春节")).toBe(true);
    expect(titles.has("劳动节")).toBe(true);
    // 调休上班日不应出现为条目
    expect(items.some((i) => i.date === "2026-02-14")).toBe(false);
  });

  test("传统节日含除夕与元宵", () => {
    const items = expandTraditionalYear(2026);
    expect(items.some((i) => i.title === "除夕" && i.date === "2026-02-16")).toBe(true);
    expect(items.some((i) => i.title === "元宵节")).toBe(true);
  });

  test("国际节日含圣诞", () => {
    const items = expandInternationalYear(2026);
    expect(items.find((i) => i.title === "圣诞节")?.date).toBe("2026-12-25");
  });

  test("二十四节气约 24 条且含清明", () => {
    const items = expandSolarTermYear(2026);
    expect(items.length).toBeGreaterThanOrEqual(23);
    expect(items.length).toBeLessThanOrEqual(24);
    expect(items.some((i) => i.title === "清明" && i.date === "2026-04-05")).toBe(true);
  });

  test("expandBuiltinSourceYear 分发", () => {
    expect(expandBuiltinSourceYear("international", 2026).length).toBe(6);
  });

  test("filter 与 dedupe", () => {
    const a = expandInternationalYear(2026);
    const filtered = filterBuiltinItemsByDateRange(a, "2026-12-01", "2026-12-31");
    expect(filtered.map((i) => i.title)).toEqual(["平安夜", "圣诞节"]);
    const duped = dedupeBuiltinItemsByDateTitle([
      { id: "1", source: "cn_holiday", title: "清明", date: "2026-04-05" },
      { id: "2", source: "solar_term", title: "清明", date: "2026-04-05" },
    ]);
    expect(duped).toHaveLength(1);
    expect(duped[0]?.source).toBe("cn_holiday");
  });

  test("yearsOverlappingRange", () => {
    expect(yearsOverlappingRange("2025-12-01T00:00:00+08:00", "2026-01-15T00:00:00+08:00")).toEqual(
      [2025, 2026],
    );
  });
});
