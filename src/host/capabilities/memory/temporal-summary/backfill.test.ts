import { describe, expect, it } from "bun:test";

import {
  clampTemporalBackfillRange,
  listCstDaysInRange,
  listExpectedPeriodStarts,
  listMissingPeriodStarts,
  listMonthPeriodStartsInRange,
  listYearPeriodStartsInRange,
} from "./backfill.ts";

describe("listCstDaysInRange", () => {
  it("lists inclusive days", () => {
    expect(listCstDaysInRange("2026-01-30", "2026-02-02")).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
      "2026-02-02",
    ]);
  });

  it("returns empty when from > to", () => {
    expect(listCstDaysInRange("2026-02-01", "2026-01-01")).toEqual([]);
  });
});

describe("listMonthPeriodStartsInRange", () => {
  it("covers months spanning from/to", () => {
    expect(listMonthPeriodStartsInRange("2025-11-15", "2026-02-03")).toEqual([
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
    ]);
  });
});

describe("listYearPeriodStartsInRange", () => {
  it("covers years", () => {
    expect(listYearPeriodStartsInRange("2024-06-01", "2026-01-01")).toEqual([
      "2024-01-01",
      "2025-01-01",
      "2026-01-01",
    ]);
  });
});

describe("clampTemporalBackfillRange", () => {
  it("caps to to CST today", () => {
    const r = clampTemporalBackfillRange({
      from: "2026-08-01",
      to: "2026-12-31",
      today: "2026-08-11",
    });
    expect(r).toEqual({
      from: "2026-08-01",
      to: "2026-08-11",
      today: "2026-08-11",
      clamped: true,
    });
  });

  it("returns null when range is entirely in the future", () => {
    expect(
      clampTemporalBackfillRange({
        from: "2026-08-12",
        to: "2026-08-20",
        today: "2026-08-11",
      }),
    ).toBeNull();
  });
});

describe("listMissingPeriodStarts", () => {
  it("skips existing periods", () => {
    expect(
      listMissingPeriodStarts({
        window: "day",
        from: "2026-01-01",
        to: "2026-01-03",
        today: "2026-08-11",
        existing: new Set(["2026-01-02"]),
      }),
    ).toEqual(["2026-01-01", "2026-01-03"]);
  });

  it("does not enumerate days after CST today", () => {
    expect(
      listMissingPeriodStarts({
        window: "day",
        from: "2026-08-10",
        to: "2026-08-20",
        today: "2026-08-11",
        existing: new Set(),
      }),
    ).toEqual(["2026-08-10", "2026-08-11"]);
  });

  it("delegates window shape", () => {
    expect(listExpectedPeriodStarts("month", "2026-01-10", "2026-03-01")).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
  });
});
