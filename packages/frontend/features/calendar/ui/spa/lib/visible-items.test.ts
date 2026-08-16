import { describe, expect, test } from "bun:test";

import { filterVisibleCalendarItems } from "./visible-items.ts";
import type { CalendarRangeItem } from "./api.ts";

function task(
  partial: Pick<Extract<CalendarRangeItem, { kind: "task" }>, "id" | "due_at"> & {
    virtual?: boolean;
  },
): Extract<CalendarRangeItem, { kind: "task" }> {
  return {
    kind: "task",
    title: "t",
    status: "pending",
    priority: "none",
    project_id: null,
    list_id: 1,
    id: partial.id,
    due_at: partial.due_at,
    ...(partial.virtual !== undefined ? { virtual: partial.virtual } : {}),
  };
}

describe("filterVisibleCalendarItems", () => {
  test("展开开启时原样返回", () => {
    const items: CalendarRangeItem[] = [
      task({ id: 1, due_at: "2026-08-01T09:00:00+08:00", virtual: true }),
      task({ id: 1, due_at: "2026-07-25T09:00:00+08:00" }),
    ];
    expect(filterVisibleCalendarItems(items, true)).toEqual(items);
  });

  test("展开关闭时去掉 virtual 任务", () => {
    const live = task({ id: 1, due_at: "2026-07-25T09:00:00+08:00" });
    const virtual = task({ id: 1, due_at: "2026-08-01T09:00:00+08:00", virtual: true });
    const event: Extract<CalendarRangeItem, { kind: "event" }> = {
      kind: "event",
      id: 9,
      title: "e",
      content: "",
      start_at: "2026-08-01T10:00:00+08:00",
      end_at: "2026-08-01T11:00:00+08:00",
      all_day: false,
      remind_at: null,
    };
    const out = filterVisibleCalendarItems([live, virtual, event], false);
    expect(out).toEqual([live, event]);
  });
});
