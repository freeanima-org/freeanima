import { describe, expect, it } from "bun:test";

import {
  shouldSendTaskReminder,
  taskReminderSourceRef,
  triggerMs,
} from "./task-reminder-handler.ts";

describe("triggerMs", () => {
  it("prefers remind_at over due_at", () => {
    const remind = "2026-06-28T08:00:00.000Z";
    const due = "2026-06-28T18:00:00.000Z";
    expect(triggerMs({ remind_at: remind, due_at: due })).toBe(Date.parse(remind));
  });

  it("falls back to due_at when remind_at absent", () => {
    const due = "2026-06-28T18:00:00.000Z";
    expect(triggerMs({ due_at: due })).toBe(Date.parse(due));
  });

  it("returns null when neither set", () => {
    expect(triggerMs({})).toBeNull();
  });
});

describe("shouldSendTaskReminder", () => {
  const due = "2026-06-28T10:00:00.000Z";
  const at = Date.parse(due);

  it("sends when trigger passed and never notified", () => {
    expect(shouldSendTaskReminder({ due_at: due }, at + 60_000)).toBe(true);
  });

  it("skips when trigger is in the future", () => {
    expect(shouldSendTaskReminder({ due_at: due }, at - 1)).toBe(false);
  });

  it("skips when last_notified_at covers trigger", () => {
    expect(
      shouldSendTaskReminder(
        { due_at: due, last_notified_at: "2026-06-28T10:01:00.000Z" },
        at + 60_000,
      ),
    ).toBe(false);
  });

  it("sends again when due_at moved later after notify", () => {
    const laterDue = "2026-06-28T12:00:00.000Z";
    expect(
      shouldSendTaskReminder(
        { due_at: laterDue, last_notified_at: "2026-06-28T10:01:00.000Z" },
        Date.parse(laterDue) + 1,
      ),
    ).toBe(true);
  });
});

describe("taskReminderSourceRef", () => {
  it("includes trigger iso", () => {
    const ms = Date.parse("2026-06-28T10:00:00.000Z");
    expect(taskReminderSourceRef(42, ms)).toBe("task_item:42:trigger:2026-06-28T10:00:00.000Z");
  });
});
