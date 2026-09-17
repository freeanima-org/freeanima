import { describe, expect, it } from "bun:test";

import {
  parseCalendarEventSearchFilters,
  parseContentBlockSearchFilters,
  parseDiaryEntrySearchFilters,
  parsePomodoroSessionSearchFilters,
  parseProjectSearchFilters,
  parseTaskItemSearchFilters,
} from "./search-filters.ts";

describe("parseTaskItemSearchFilters", () => {
  it("parseTaskItemSearchFilters accepts task_item filter shape", () => {
    const parsed = parseTaskItemSearchFilters({
      list_id: 2,
      status: "pending",
      tag_ids: [3],
      due_today: true,
    });
    expect(parsed.list_id).toBe(2);
    expect(parsed.status).toBe("pending");
    expect(parsed.tag_ids).toEqual([3]);
    expect(parsed.due_today).toBe(true);
  });

  it("parseTaskItemSearchFilters rejects unknown fields", () => {
    expect(() => parseTaskItemSearchFilters({ foo: "bar" })).toThrow(/invalid task_item filters/);
  });
});

describe("parseDiaryEntrySearchFilters", () => {
  it("accepts diary_entry filter shape", () => {
    const parsed = parseDiaryEntrySearchFilters({
      entry_after: "2026-06-01T00:00:00+08:00",
      entry_before: "2026-06-30T23:59:59+08:00",
      tag_ids: [7],
    });
    expect(parsed.entry_after).toBe("2026-06-01T00:00:00+08:00");
    expect(parsed.tag_ids).toEqual([7]);
  });

  it("accepts client_op_id for idempotent create lookup", () => {
    const parsed = parseDiaryEntrySearchFilters({ client_op_id: "op-123" });
    expect(parsed.client_op_id).toBe("op-123");
  });

  it("rejects unknown fields", () => {
    expect(() => parseDiaryEntrySearchFilters({ foo: "bar" })).toThrow(
      /invalid diary_entry filters/,
    );
  });
});

describe("parseCalendarEventSearchFilters", () => {
  it("accepts range overlap filters", () => {
    const parsed = parseCalendarEventSearchFilters({
      range_start: "2026-07-01T00:00:00+08:00",
      range_end: "2026-07-31T23:59:59+08:00",
      client_op_id: "op-cal",
    });
    expect(parsed.range_start).toBe("2026-07-01T00:00:00+08:00");
    expect(parsed.range_end).toBe("2026-07-31T23:59:59+08:00");
    expect(parsed.client_op_id).toBe("op-cal");
  });

  it("rejects unknown fields", () => {
    expect(() => parseCalendarEventSearchFilters({ foo: 1 })).toThrow(
      /invalid calendar_event filters/,
    );
  });
});

describe("parseProjectSearchFilters", () => {
  it("accepts range overlap filters", () => {
    const parsed = parseProjectSearchFilters({
      range_start: "2026-07-01T00:00:00+08:00",
      range_end: "2026-07-31T23:59:59+08:00",
    });
    expect(parsed.range_start).toBe("2026-07-01T00:00:00+08:00");
  });
});

describe("parseContentBlockSearchFilters", () => {
  it("accepts content_block filter shape via search-filters barrel", () => {
    const parsed = parseContentBlockSearchFilters({ parent_id: 3, block_type: "image" });
    expect(parsed.parent_id).toBe(3);
    expect(parsed.block_type).toBe("image");
  });
});

describe("parsePomodoroSessionSearchFilters", () => {
  it("accepts pomodoro_session filter shape", () => {
    const parsed = parsePomodoroSessionSearchFilters({
      started_after: "2026-07-09T00:00:00+08:00",
      phase: "work",
      task_item_id: 12,
    });
    expect(parsed.started_after).toBe("2026-07-09T00:00:00+08:00");
    expect(parsed.phase).toBe("work");
    expect(parsed.task_item_id).toBe(12);
  });

  it("rejects unknown fields", () => {
    expect(() => parsePomodoroSessionSearchFilters({ foo: "bar" })).toThrow(
      /invalid pomodoro_session filters/,
    );
  });
});
