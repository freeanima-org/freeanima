import { describe, expect, test } from "bun:test";

import {
  addDaysToDateLocal,
  addMonthsToDateLocal,
  dateLocalPresets,
  formatDateTime,
  formatDue,
  formatDueChip,
  formatRemindChip,
  mergeDateTimeLocal,
  parseDateLocalValue,
} from "./datetime-local.ts";

describe("formatDateTime", () => {
  test("empty shows em dash", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDateTime("")).toBe("—");
  });

  test("invalid returns raw", () => {
    expect(formatDateTime("not-a-date")).toBe("not-a-date");
  });
});

describe("formatDue", () => {
  test("empty / invalid", () => {
    expect(formatDue(null)).toBe("");
    expect(formatDue("not-a-date")).toBe("not-a-date");
  });

  test("same year omits year", () => {
    const sameYear = new Date();
    sameYear.setMonth(6, 13);
    sameYear.setHours(12, 0, 0, 0);
    const label = formatDue(sameYear.toISOString());
    expect(label).toBe(sameYear.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
    expect(label).not.toContain(String(sameYear.getFullYear()));
  });

  test("other year includes year", () => {
    const otherYear = new Date();
    otherYear.setFullYear(otherYear.getFullYear() - 1);
    otherYear.setMonth(6, 13);
    otherYear.setHours(12, 0, 0, 0);
    const label = formatDue(otherYear.toISOString());
    expect(label).toBe(
      otherYear.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    );
    expect(label).toContain(String(otherYear.getFullYear()));
  });
});

describe("formatDueChip", () => {
  test("empty due shows placeholder", () => {
    expect(formatDueChip(null)).toEqual({ label: "截止日期", overdue: false });
    expect(formatDueChip(undefined)).toEqual({ label: "截止日期", overdue: false });
  });

  test("future due is not overdue", () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    future.setHours(12, 0, 0, 0);
    const result = formatDueChip(future.toISOString());
    expect(result.overdue).toBe(false);
    expect(result.label).toBe(`${future.getMonth() + 1}月${future.getDate()}日`);
  });

  test("past due includes 延期 days", () => {
    const past = new Date();
    past.setDate(past.getDate() - 4);
    past.setHours(12, 0, 0, 0);
    const result = formatDueChip(past.toISOString());
    expect(result.overdue).toBe(true);
    expect(result.label).toBe(`${past.getMonth() + 1}月${past.getDate()}日, 延期4天`);
  });

  test("other year includes year", () => {
    const otherYear = new Date();
    otherYear.setFullYear(otherYear.getFullYear() - 1, 6, 13);
    otherYear.setHours(12, 0, 0, 0);
    const result = formatDueChip(otherYear.toISOString());
    expect(result.label.startsWith(`${otherYear.getFullYear()}年7月13日`)).toBe(true);
  });
});

describe("formatRemindChip", () => {
  test("empty shows placeholder", () => {
    expect(formatRemindChip(null)).toBe("提醒");
    expect(formatRemindChip(undefined)).toBe("提醒");
  });

  test("formats date and time", () => {
    const at = new Date();
    at.setHours(9, 30, 0, 0);
    expect(formatRemindChip(at.toISOString())).toBe(
      `${at.getMonth() + 1}月${at.getDate()}日 09:30`,
    );
  });

  test("other year includes year", () => {
    const at = new Date();
    at.setFullYear(at.getFullYear() + 1, 0, 5);
    at.setHours(9, 30, 0, 0);
    expect(formatRemindChip(at.toISOString())).toBe(`${at.getFullYear()}年1月5日 09:30`);
  });
});

describe("parseDateLocalValue / addDays / addMonths", () => {
  test("parse valid and reject invalid", () => {
    const d = parseDateLocalValue("2026-01-31");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(0);
    expect(d?.getDate()).toBe(31);
    expect(parseDateLocalValue("2026-02-30")).toBeNull();
    expect(parseDateLocalValue("nope")).toBeNull();
  });

  test("addDaysToDateLocal", () => {
    expect(addDaysToDateLocal("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysToDateLocal("2026-01-01", 7)).toBe("2026-01-08");
  });

  test("addMonthsToDateLocal clamps overflow", () => {
    expect(addMonthsToDateLocal("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsToDateLocal("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonthsToDateLocal("2026-03-31", 1)).toBe("2026-04-30");
  });
});

describe("dateLocalPresets", () => {
  test("labels and relative offsets from today", () => {
    const presets = dateLocalPresets();
    expect(presets.map((p) => p.id)).toEqual(["today", "tomorrow", "next_week", "next_month"]);
    expect(presets.map((p) => p.label)).toEqual(["今天", "明天", "下周", "下个月"]);
    const today = presets[0]!.value;
    expect(presets[1]!.value).toBe(addDaysToDateLocal(today, 1));
    expect(presets[2]!.value).toBe(addDaysToDateLocal(today, 7));
    expect(presets[3]!.value).toBe(addMonthsToDateLocal(today, 1));
  });
});

describe("mergeDateTimeLocal", () => {
  test("returns host-TZ ISO rather than bare Z from toISOString", () => {
    const iso = mergeDateTimeLocal("2026-08-17", "09:30");
    expect(iso).toBeTruthy();
    expect(iso!).not.toMatch(/Z$/);
    expect(iso!).toMatch(/[+-]\d{2}:\d{2}$/);
  });

  test("empty date returns null", () => {
    expect(mergeDateTimeLocal("", "09:00")).toBeNull();
  });
});
