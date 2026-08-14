import { describe, expect, test } from "bun:test";
import {
  mapCalendarEventBodyToTaskItemFields,
  mapTaskItemBodyToCalendarEvent,
} from "./convert-task-event.ts";

describe("mapTaskItemBodyToCalendarEvent", () => {
  test("due only → start=due, end=null", () => {
    const body = mapTaskItemBodyToCalendarEvent({
      due_at: "2026-08-11T12:00:00+08:00",
      remind_at: "2026-08-11T11:00:00+08:00",
    });
    expect(body.start_at).toBe("2026-08-11T12:00:00+08:00");
    expect(body.end_at).toBeNull();
    expect(body.remind_at).toBe("2026-08-11T11:00:00+08:00");
    expect(body.all_day).toBe(false);
  });

  test("start+due → interval", () => {
    const body = mapTaskItemBodyToCalendarEvent({
      start_at: "2026-08-11T10:00:00+08:00",
      due_at: "2026-08-11T12:00:00+08:00",
    });
    expect(body.start_at).toBe("2026-08-11T10:00:00+08:00");
    expect(body.end_at).toBe("2026-08-11T12:00:00+08:00");
  });

  test("rejects no time", () => {
    expect(() => mapTaskItemBodyToCalendarEvent({})).toThrow(/start_at or due_at/);
  });

  test("earliest reminder from reminders[]", () => {
    const body = mapTaskItemBodyToCalendarEvent({
      due_at: "2026-08-11T12:00:00+08:00",
      reminders: [{ at: "2026-08-11T11:30:00+08:00" }, { at: "2026-08-11T10:00:00+08:00" }],
    });
    expect(body.remind_at).toBe("2026-08-11T10:00:00+08:00");
  });
});

describe("mapCalendarEventBodyToTaskItemFields", () => {
  test("no end → due=start, start_at null", () => {
    const body = mapCalendarEventBodyToTaskItemFields(
      { start_at: "2026-08-11T12:00:00+08:00", remind_at: "2026-08-11T11:00:00+08:00" },
      { list_id: 1, sort_order: -10 },
    );
    expect(body.due_at).toBe("2026-08-11T12:00:00+08:00");
    expect(body.start_at).toBeNull();
    expect(body.list_id).toBe(1);
    expect(body.status).toBe("pending");
    expect(body.remind_at).toBe("2026-08-11T11:00:00+08:00");
  });

  test("with end → start/due interval", () => {
    const body = mapCalendarEventBodyToTaskItemFields(
      {
        start_at: "2026-08-11T10:00:00+08:00",
        end_at: "2026-08-11T12:00:00+08:00",
      },
      { list_id: 2, sort_order: 0 },
    );
    expect(body.start_at).toBe("2026-08-11T10:00:00+08:00");
    expect(body.due_at).toBe("2026-08-11T12:00:00+08:00");
  });
});
