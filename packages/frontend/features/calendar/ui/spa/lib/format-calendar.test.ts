import { describe, expect, it } from "bun:test";

import { buildMonthGrid, dayKeyFromIso, monthRangeIso, shiftMonth } from "./format-calendar.ts";

describe("format-calendar", () => {
  it("dayKeyFromIso uses CST calendar day", () => {
    expect(dayKeyFromIso("2026-07-31T09:00:00+08:00")).toBe("2026-07-31");
    // 本地/UTC 存盘常见：次日 00:00 CST = 前日 16:00Z
    expect(dayKeyFromIso("2026-08-01T16:00:00.000Z")).toBe("2026-08-02");
    expect(dayKeyFromIso("2026-07-31T16:00:00.000Z")).toBe("2026-08-01");
    expect(dayKeyFromIso("2026-08-02")).toBe("2026-08-02");
  });

  it("monthRangeIso covers CST month bounds", () => {
    const range = monthRangeIso(2026, 6);
    expect(range.from).toBe("2026-07-01T00:00:00+08:00");
    expect(range.to).toBe("2026-07-31T23:59:59+08:00");
  });

  it("shiftMonth wraps year", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, monthIndex: 0 });
  });

  it("buildMonthGrid pads to weeks", () => {
    const cells = buildMonthGrid(2026, 6);
    expect(cells.length % 7).toBe(0);
    expect(cells.filter(Boolean).length).toBe(31);
  });
});
