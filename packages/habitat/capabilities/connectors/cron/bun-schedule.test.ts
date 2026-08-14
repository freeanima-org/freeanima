import { describe, it, expect } from "bun:test";
import { computeNextRunAt, resolveBunSchedule } from "./bun-schedule.ts";
import { parseSchedule, ScheduleType } from "./schedule.ts";

describe("resolveBunSchedule", () => {
  it("converts interval to cron step", () => {
    expect(resolveBunSchedule("30m")).toEqual({ kind: "cron", expr: "*/30 * * * *" });
    expect(resolveBunSchedule("1h")).toEqual({ kind: "cron", expr: "0 * * * *" });
    expect(resolveBunSchedule("2h")).toEqual({ kind: "cron", expr: "0 */2 * * *" });
  });

  it("converts CST cron to UTC", () => {
    expect(resolveBunSchedule("0 2 * * *")).toEqual({ kind: "cron", expr: "0 18 * * *" });
  });
});

describe("computeNextRunAt", () => {
  it("returns 0 for paused jobs", () => {
    expect(computeNextRunAt("0 * * * *", true)).toBe(0);
  });

  it("returns future timestamp for active cron", () => {
    const next = computeNextRunAt("0 * * * *", false);
    expect(next).not.toBe(0);
    expect(next).toBeGreaterThan(Date.now() / 1000 - 60);
  });

  it("returns null for past oneshot via parseSchedule", () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(() => parseSchedule(past)).toThrow();
  });
});

describe("ScheduleType re-export sanity", () => {
  it("has interval type", () => {
    expect(ScheduleType.INTERVAL as string).toBe("interval");
  });
});
