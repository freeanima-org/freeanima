import { describe, expect, it } from "bun:test";

import { cstCalendarDateString, cstDaySourceRef } from "./notify.ts";

describe("cstDaySourceRef", () => {
  it("uses CST calendar date", () => {
    // 2026-07-27 20:00 UTC = 2026-07-28 04:00 CST
    const ms = Date.parse("2026-07-27T20:00:00.000Z");
    expect(cstCalendarDateString(ms)).toBe("2026-07-28");
    expect(cstDaySourceRef("prompt:fold_budget", ms)).toBe("prompt:fold_budget:2026-07-28");
  });
});
