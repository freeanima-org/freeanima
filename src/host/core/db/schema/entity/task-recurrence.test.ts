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
    });
    expect(next.startsWith("2026-08-01T09:00:00")).toBe(true);
  });

  test("weekly without weekdays adds interval weeks", () => {
    const next = advanceScheduleAt("2026-07-31T09:00:00+08:00", {
      freq: "weekly",
      interval: 1,
    });
    expect(next.startsWith("2026-08-07T09:00:00")).toBe(true);
  });

  test("monthly clamps day overflow", () => {
    const next = advanceScheduleAt("2026-01-31T09:00:00+08:00", {
      freq: "monthly",
      interval: 1,
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
});
