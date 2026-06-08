import { describe, it, expect } from "bun:test";
import { parseSchedule, ScheduleType } from "../../src/schedule.ts";

describe("parseSchedule", () => {
  it("parses interval expressions", () => {
    expect(parseSchedule("30m")).toEqual([ScheduleType.INTERVAL, 30 * 60]);
    expect(parseSchedule("every 2h")).toEqual([ScheduleType.INTERVAL, 2 * 3600]);
  });

  it("rejects interval shorter than 1m", () => {
    expect(() => parseSchedule("30s")).toThrow(/Unrecognised|too short/i);
  });

  it("parses valid 5-field cron", () => {
    expect(parseSchedule("0 9 * * *")).toEqual([ScheduleType.CRON, "0 9 * * *"]);
    expect(parseSchedule("*/15 * * * *")).toEqual([ScheduleType.CRON, "*/15 * * * *"]);
  });

  it("rejects invalid cron", () => {
    expect(() => parseSchedule("not a cron")).toThrow();
    expect(() => parseSchedule("0 9 * *")).toThrow();
  });

  it("parses future oneshot ISO timestamp", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const [type, value] = parseSchedule(future);
    expect(type).toBe(ScheduleType.ONESHOT);
    expect(value).toBeGreaterThan(Date.now() / 1000);
  });

  it("rejects past oneshot", () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(() => parseSchedule(past)).toThrow(/past/i);
  });
});
