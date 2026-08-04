import { describe, expect, it } from "bun:test";
import { computeSleepCatchUpDays, listMonthStartsInRange, todayCstDay } from "./sleep-catch-up.ts";

describe("listMonthStartsInRange", () => {
  it("lists month starts inside inclusive range", () => {
    expect(listMonthStartsInRange("2026-01-15", "2026-03-10")).toEqual([
      "2026-02-01",
      "2026-03-01",
    ]);
  });

  it("includes boundary month starts", () => {
    expect(listMonthStartsInRange("2026-02-01", "2026-02-01")).toEqual(["2026-02-01"]);
  });

  it("includes Jan 1 when in range", () => {
    expect(listMonthStartsInRange("2026-01-01", "2026-01-15")).toEqual(["2026-01-01"]);
  });

  it("returns empty when from > to", () => {
    expect(listMonthStartsInRange("2026-03-01", "2026-01-01")).toEqual([]);
  });
});

describe("computeSleepCatchUpDays", () => {
  it("computes light and temporal gaps and cascade month starts", () => {
    const result = computeSleepCatchUpDays({
      activityDays: ["2026-01-10", "2026-01-20", "2026-02-05"],
      completedLightDays: new Set(["2026-01-10"]),
      existingTemporalDays: new Set(["2026-01-20"]),
      from: "2026-01-01",
      to: "2026-02-15",
    });
    expect(result.light_days).toEqual(["2026-01-20", "2026-02-05"]);
    expect(result.temporal_days).toEqual(["2026-01-10", "2026-02-05"]);
    expect(result.days).toEqual(["2026-01-10", "2026-01-20", "2026-02-05"]);
    expect(result.cascade_days).toEqual(["2026-01-01", "2026-02-01"]);
  });

  it("omits cascade when nothing to catch up", () => {
    const result = computeSleepCatchUpDays({
      activityDays: ["2026-01-10"],
      completedLightDays: new Set(["2026-01-10"]),
      existingTemporalDays: new Set(["2026-01-10"]),
      from: "2026-01-01",
      to: "2026-01-31",
    });
    expect(result.light_days).toEqual([]);
    expect(result.temporal_days).toEqual([]);
    expect(result.cascade_days).toEqual([]);
  });
});

describe("todayCstDay", () => {
  it("formats a fixed instant in CST", () => {
    // 2026-07-27T18:00:00Z = 2026-07-28 02:00 CST
    expect(todayCstDay(Date.parse("2026-07-27T18:00:00.000Z"))).toBe("2026-07-28");
  });
});
