import { describe, expect, test } from "bun:test";
import {
  mapCalendarEventBodyToTaskItemFields,
  mapTaskItemBodyToCalendarEvent,
} from "./convert-task-event.ts";

describe("mapTaskItemBodyToCalendarEvent", () => {
  test("计划单点 → start，end=null", () => {
    const body = mapTaskItemBodyToCalendarEvent({
      start_at: "2026-08-11T12:00:00+08:00",
      remind_at: "2026-08-11T11:00:00+08:00",
    });
    expect(body.start_at).toBe("2026-08-11T12:00:00+08:00");
    expect(body.end_at).toBeNull();
    expect(body.remind_at).toBe("2026-08-11T11:00:00+08:00");
    expect(body.all_day).toBe(false);
  });

  test("计划时段 → start/end", () => {
    const body = mapTaskItemBodyToCalendarEvent({
      start_at: "2026-08-11T10:00:00+08:00",
      end_at: "2026-08-11T12:00:00+08:00",
    });
    expect(body.start_at).toBe("2026-08-11T10:00:00+08:00");
    expect(body.end_at).toBe("2026-08-11T12:00:00+08:00");
  });

  test("仅 deadline 不可转事件", () => {
    expect(() => mapTaskItemBodyToCalendarEvent({ due_at: "2026-08-11T12:00:00+08:00" })).toThrow(
      /planned time/,
    );
  });

  test("rejects no time", () => {
    expect(() => mapTaskItemBodyToCalendarEvent({})).toThrow(/planned time/);
  });

  test("earliest reminder from reminders[]；锚点改 start", () => {
    const body = mapTaskItemBodyToCalendarEvent({
      start_at: "2026-08-11T12:00:00+08:00",
      reminders: [
        { at: "2026-08-11T11:30:00+08:00", anchor: "end" },
        { at: "2026-08-11T10:00:00+08:00", anchor: "due" },
      ],
    });
    expect(body.remind_at).toBe("2026-08-11T10:00:00+08:00");
    expect(body.reminders?.every((r) => r.anchor === "start")).toBe(true);
  });
});

describe("mapCalendarEventBodyToTaskItemFields", () => {
  test("计划 1:1；不填 deadline", () => {
    const body = mapCalendarEventBodyToTaskItemFields(
      { start_at: "2026-08-11T12:00:00+08:00", remind_at: "2026-08-11T11:00:00+08:00" },
      { list_id: 1, sort_order: -10 },
    );
    expect(body.start_at).toBe("2026-08-11T12:00:00+08:00");
    expect(body.end_at).toBeNull();
    expect(body.due_at).toBeNull();
    expect(body.list_id).toBe(1);
    expect(body.status).toBe("pending");
    expect(body.remind_at).toBe("2026-08-11T11:00:00+08:00");
  });

  test("with end → 计划时段，due 仍空", () => {
    const body = mapCalendarEventBodyToTaskItemFields(
      {
        start_at: "2026-08-11T10:00:00+08:00",
        end_at: "2026-08-11T12:00:00+08:00",
      },
      { list_id: 2, sort_order: 0 },
    );
    expect(body.start_at).toBe("2026-08-11T10:00:00+08:00");
    expect(body.end_at).toBe("2026-08-11T12:00:00+08:00");
    expect(body.due_at).toBeNull();
  });
});
