import { describe, expect, it } from "bun:test";
import {
  isCstMonthStart,
  isCstYearStart,
  lastDayOfMonthPeriod,
  previousMonthPeriodStart,
  sysRollRedisKey,
  sysRollSourcesFp,
} from "./buckets.ts";

describe("cascade period helpers", () => {
  it("detects month/year starts", () => {
    expect(isCstMonthStart("2026-02-01")).toBe(true);
    expect(isCstMonthStart("2026-02-02")).toBe(false);
    expect(isCstYearStart("2026-01-01")).toBe(true);
    expect(isCstYearStart("2026-02-01")).toBe(false);
  });

  it("computes previous month and last day", () => {
    expect(previousMonthPeriodStart("2026-01-01")).toBe("2025-12-01");
    expect(previousMonthPeriodStart("2026-03-01")).toBe("2026-02-01");
    expect(lastDayOfMonthPeriod("2026-02-01")).toBe("2026-02-28");
    expect(lastDayOfMonthPeriod("2024-02-01")).toBe("2024-02-29");
  });
});

describe("sysRoll keys", () => {
  it("builds stable redis keys without fingerprint", () => {
    expect(
      sysRollRedisKey({
        prefix: "anima:temporal",
        kind: "past_days",
        anchor: "2026-08-04",
        world_id: 42,
      }),
    ).toBe("anima:temporal:sys_roll:w42:past_days:2026-08-04");
    expect(
      sysRollRedisKey({
        prefix: "anima:temporal",
        kind: "past_months",
        anchor: "2026-08",
        world_id: 7,
      }),
    ).toBe("anima:temporal:sys_roll:w7:past_months:2026-08");
  });

  it("fingerprints source rows order-independently", () => {
    const a = sysRollSourcesFp([
      { period_start: "2026-08-02", content: "b" },
      { period_start: "2026-08-01", content: "a" },
    ]);
    const b = sysRollSourcesFp([
      { period_start: "2026-08-01", content: "a" },
      { period_start: "2026-08-02", content: "b" },
    ]);
    expect(a).toBe(b);
  });
});
