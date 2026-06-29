import { describe, expect, it } from "bun:test";

import { defaultEntryAtIso, entryDayKey, parseDiaryDate } from "./entry-store.ts";

describe("parseDiaryDate", () => {
  it("defaults to today CST noon", () => {
    const parsed = parseDiaryDate(null);
    expect(entryDayKey(parsed)).toBe(entryDayKey(defaultEntryAtIso()));
    expect(parsed.endsWith("T12:00:00+08:00")).toBe(true);
  });

  it("accepts YYYY-MM-DD", () => {
    expect(parseDiaryDate("2026-06-28")).toBe("2026-06-28T12:00:00+08:00");
  });

  it("normalizes ISO to day noon", () => {
    expect(parseDiaryDate("2026-06-28T08:30:00+08:00")).toBe("2026-06-28T12:00:00+08:00");
  });

  it("rejects invalid date", () => {
    expect(() => parseDiaryDate("not-a-date")).toThrow(/invalid diary date/);
  });
});

describe("entryDayKey", () => {
  it("extracts YYYY-MM-DD from entry_at", () => {
    expect(entryDayKey("2026-06-29T12:00:00+08:00")).toBe("2026-06-29");
  });
});
