import { describe, expect, test } from "bun:test";

import {
  dayHeadingLabel,
  dayRangeIso,
  listDayKeys,
  nDayRangeIso,
  shiftDayKey,
} from "./format-calendar.ts";

describe("format-calendar day windows", () => {
  test("shiftDayKey 前一天后一天", () => {
    expect(shiftDayKey("2026-08-19", 1)).toBe("2026-08-20");
    expect(shiftDayKey("2026-08-19", 2)).toBe("2026-08-21");
    expect(shiftDayKey("2026-08-19", -1)).toBe("2026-08-18");
    expect(shiftDayKey("2026-08-01", -1)).toBe("2026-07-31");
    expect(shiftDayKey("bad", 1)).toBeNull();
  });

  test("listDayKeys 近三天/近七天", () => {
    expect(listDayKeys("2026-08-19", 3)).toEqual(["2026-08-19", "2026-08-20", "2026-08-21"]);
    expect(listDayKeys("2026-08-19", 7)).toHaveLength(7);
    expect(listDayKeys("2026-08-19", 7)[6]).toBe("2026-08-25");
  });

  test("nDayRangeIso 含起止日", () => {
    const three = nDayRangeIso("2026-08-19", 3);
    expect(three.from.startsWith("2026-08-19T00:00:00")).toBe(true);
    expect(three.to.startsWith("2026-08-21T23:59:59")).toBe(true);
    const one = dayRangeIso("2026-08-20");
    expect(one.from.startsWith("2026-08-20T00:00:00")).toBe(true);
    expect(one.to.startsWith("2026-08-20T23:59:59")).toBe(true);
  });

  test("dayHeadingLabel", () => {
    expect(dayHeadingLabel("2026-08-19", "2026-08-19")).toBe("今天 8月19日");
    expect(dayHeadingLabel("2026-08-20", "2026-08-19")).toBe("8月20日");
  });
});
