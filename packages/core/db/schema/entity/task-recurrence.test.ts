import { describe, expect, test } from "bun:test";

import {
  advanceScheduleAt,
  computeNextOccurrence,
  normalizeRecurrenceInput,
  shiftRemindAt,
  taskRecurrenceSchema,
} from "./task-recurrence.ts";

describe("task-recurrence", () => {
  test("daily advance by interval", () => {
    const next = advanceScheduleAt("2026-07-31T09:00:00+08:00", {
      freq: "daily",
      interval: 1,
      skip: "none",
      workdays_only: false,
      calendar: "gregorian",
    });
    expect(next.startsWith("2026-08-01T09:00:00")).toBe(true);
  });

  test("weekly without weekdays adds interval weeks", () => {
    const next = advanceScheduleAt("2026-07-31T09:00:00+08:00", {
      freq: "weekly",
      interval: 1,
      skip: "none",
      workdays_only: false,
      calendar: "gregorian",
    });
    expect(next.startsWith("2026-08-07T09:00:00")).toBe(true);
  });

  test("monthly clamps day overflow", () => {
    const next = advanceScheduleAt("2026-01-31T09:00:00+08:00", {
      freq: "monthly",
      interval: 1,
      skip: "none",
      workdays_only: false,
      calendar: "gregorian",
    });
    expect(next.startsWith("2026-02-28T09:00:00")).toBe(true);
  });

  test("computeNextOccurrence due anchor rolls schedule_at", () => {
    const recurrence = taskRecurrenceSchema.parse({
      freq: "daily",
      interval: 1,
      anchor: "due",
      schedule_at: "2026-07-31T09:00:00+08:00",
    });
    const next = computeNextOccurrence(recurrence, {
      completedAt: "2026-07-31T20:00:00+08:00",
    });
    expect(next).not.toBeNull();
    expect(next?.due_at.startsWith("2026-08-01T09:00:00")).toBe(true);
    expect(next?.recurrence.schedule_at.startsWith("2026-08-01T09:00:00")).toBe(true);
  });

  test("computeNextOccurrence count exhaustion returns null", () => {
    const recurrence = taskRecurrenceSchema.parse({
      freq: "daily",
      interval: 1,
      anchor: "due",
      count: 1,
      schedule_at: "2026-07-31T09:00:00+08:00",
    });
    const next = computeNextOccurrence(recurrence, {
      completedAt: "2026-07-31T20:00:00+08:00",
      decrementCount: true,
    });
    expect(next).toBeNull();
  });

  test("skip does not decrement count", () => {
    const recurrence = taskRecurrenceSchema.parse({
      freq: "daily",
      interval: 1,
      anchor: "due",
      count: 2,
      schedule_at: "2026-07-31T09:00:00+08:00",
    });
    const next = computeNextOccurrence(recurrence, {
      completedAt: "2026-07-31T20:00:00+08:00",
      decrementCount: false,
    });
    expect(next?.recurrence.count).toBe(2);
  });

  test("shiftRemindAt keeps offset", () => {
    const remind = shiftRemindAt(
      "2026-07-31T09:00:00+08:00",
      "2026-07-31T08:00:00+08:00",
      "2026-08-01T09:00:00+08:00",
    );
    expect(remind?.startsWith("2026-08-01T08:00:00")).toBe(true);
  });

  test("normalizeRecurrenceInput fills schedule_at from due", () => {
    const rec = normalizeRecurrenceInput(
      { freq: "daily", interval: 1, anchor: "due" },
      "2026-07-31T09:00:00+08:00",
    );
    expect(rec.schedule_at).toBe("2026-07-31T09:00:00+08:00");
  });

  test("daily skip weekend advances Friday to Monday", () => {
    const next = advanceScheduleAt("2026-07-31T09:00:00+08:00", {
      freq: "daily",
      interval: 1,
      skip: "weekend",
      workdays_only: false,
      calendar: "gregorian",
    });
    expect(next.startsWith("2026-08-03T09:00:00")).toBe(true);
  });

  test("daily workdays_only skips weekend", () => {
    const next = advanceScheduleAt("2026-07-31T09:00:00+08:00", {
      freq: "daily",
      interval: 1,
      skip: "none",
      workdays_only: true,
      calendar: "gregorian",
    });
    expect(next.startsWith("2026-08-03T09:00:00")).toBe(true);
  });

  test("yearly lunar advances to next lunar year", () => {
    const next = advanceScheduleAt("2025-01-29T09:00:00+08:00", {
      freq: "yearly",
      interval: 1,
      calendar: "lunar",
      lunar_month: 1,
      lunar_day: 1,
      skip: "none",
      workdays_only: false,
    });
    expect(next.startsWith("2026-02-17T09:00:00")).toBe(true);
  });

  test("monthly lunar advances to next lunar month same day", () => {
    // 2025-01-29 = 农历正月初一 → 下一农历月同日 = 二月初一 = 2025-02-28
    const next = advanceScheduleAt("2025-01-29T09:00:00+08:00", {
      freq: "monthly",
      interval: 1,
      calendar: "lunar",
      lunar_day: 1,
      skip: "none",
      workdays_only: false,
    });
    expect(next.startsWith("2025-02-28T09:00:00")).toBe(true);
  });

  test("lunar yearly schema requires lunar_month/day", () => {
    const result = taskRecurrenceSchema.safeParse({
      freq: "yearly",
      interval: 1,
      anchor: "due",
      calendar: "lunar",
      schedule_at: "2025-01-29T09:00:00+08:00",
    });
    expect(result.success).toBe(false);
  });

  test("lunar monthly schema requires lunar_day", () => {
    const result = taskRecurrenceSchema.safeParse({
      freq: "monthly",
      interval: 1,
      anchor: "due",
      calendar: "lunar",
      schedule_at: "2025-01-29T09:00:00+08:00",
    });
    expect(result.success).toBe(false);
  });
});
