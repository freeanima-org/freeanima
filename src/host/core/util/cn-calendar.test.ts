import { describe, expect, test } from "bun:test";

import {
  gregorianFromLunar,
  isCnHoliday,
  isCnWeekend,
  isCnWorkday,
  lunarPartsFromGregorian,
} from "./cn-calendar.ts";
import { formatCstIso } from "./time.ts";

describe("cn-calendar", () => {
  test("isCnWeekend detects Saturday", () => {
    expect(isCnWeekend(new Date("2026-08-01T09:00:00+08:00"))).toBe(true);
  });

  test("isCnWorkday respects statutory holiday", () => {
    expect(isCnWorkday(new Date("2026-01-01T09:00:00+08:00"))).toBe(false);
  });

  test("isCnWorkday respects adjusted workday on weekend", () => {
    // 2026-02-14 春节调休上班（周六）
    expect(isCnWorkday(new Date("2026-02-14T09:00:00+08:00"))).toBe(true);
    expect(isCnWeekend(new Date("2026-02-14T09:00:00+08:00"))).toBe(true);
  });

  test("isCnHoliday on New Year", () => {
    expect(isCnHoliday(new Date("2026-01-01T09:00:00+08:00"))).toBe(true);
  });

  test("gregorianFromLunar converts lunar new year 2025", () => {
    const d = gregorianFromLunar(2025, 1, 1);
    expect(formatCstIso(d).slice(0, 10)).toBe("2025-01-29");
  });

  test("lunarPartsFromGregorian for 2026 Spring Festival", () => {
    const parts = lunarPartsFromGregorian(new Date("2026-02-17T09:00:00+08:00"));
    expect(parts).toEqual({ year: 2026, month: 1, day: 1 });
  });
});
