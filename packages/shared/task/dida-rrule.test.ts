import { describe, expect, test } from "bun:test";

import { parseDidaRepeat } from "@freeanima/shared/task/dida-rrule.ts";

const DUE = "2026-08-23T16:00:00+0000";

describe("parseDidaRepeat", () => {
  test("FREQ=YEARLY", () => {
    const r = parseDidaRepeat("FREQ=YEARLY", DUE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.recurrence.freq).toBe("yearly");
      expect(r.recurrence.interval).toBe(1);
      expect(r.recurrence.schedule_at).toBe(DUE);
    }
  });

  test("weekly BYDAY", () => {
    const r = parseDidaRepeat("FREQ=WEEKLY;BYDAY=MO", DUE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.recurrence.freq).toBe("weekly");
      expect(r.recurrence.weekdays).toEqual([1]);
    }
  });

  test("monthly BYMONTHDAY + TT_SKIP", () => {
    const r = parseDidaRepeat("FREQ=MONTHLY;INTERVAL=11;BYMONTHDAY=13;TT_SKIP=WEEKEND", DUE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.recurrence.freq).toBe("monthly");
      expect(r.recurrence.interval).toBe(11);
      expect(r.recurrence.skip).toBe("weekend");
    }
  });

  test("lunar yearly", () => {
    const r = parseDidaRepeat("LUNAR:FREQ=YEARLY;INTERVAL=1;BYMONTH=5;BYMONTHDAY=29", DUE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.recurrence.calendar).toBe("lunar");
      expect(r.recurrence.lunar_month).toBe(5);
      expect(r.recurrence.lunar_day).toBe(29);
    }
  });

  test("UNTIL + COUNT", () => {
    const r = parseDidaRepeat("FREQ=MONTHLY;UNTIL=20460601;INTERVAL=1", DUE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.recurrence.until).toContain("2046-06-01");
    }
    const c = parseDidaRepeat("FREQ=DAILY;COUNT=1;INTERVAL=1", DUE);
    expect(c.ok).toBe(true);
    if (c.ok) expect(c.recurrence.count).toBe(1);
  });

  test("ERULE CUSTOM rejected", () => {
    const r = parseDidaRepeat("ERULE:NAME=CUSTOM;BYDATE=20250903,20250904", DUE);
    expect(r.ok).toBe(false);
  });

  test("daily interval 27", () => {
    const r = parseDidaRepeat("FREQ=DAILY;INTERVAL=27", DUE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.recurrence.interval).toBe(27);
  });
});
