import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

import type { TaskItemRow } from "./types.ts";
import type { TaskOccurrenceRow } from "./occurrence-store.ts";

function itemRow(over: Partial<TaskItemRow> & Pick<TaskItemRow, "id" | "title">): TaskItemRow {
  return {
    content: "",
    tag_ids: [],
    status: "completed",
    priority: "none",
    due_at: null,
    remind_at: null,
    list_id: 1,
    project_id: null,
    sort_order: 0,
    completed_at: "2026-08-19T10:00:00+08:00",
    recurrence: null,
    primary_component: "task_item",
    created_at: "2026-08-19T09:00:00+08:00",
    updated_at: "2026-08-19T10:00:00+08:00",
    ...over,
  };
}

function occRow(
  over: Partial<TaskOccurrenceRow> & Pick<TaskOccurrenceRow, "id" | "series_task_id" | "title">,
): TaskOccurrenceRow {
  return {
    content: "",
    completed_at: "2026-08-19T11:00:00+08:00",
    due_at: "2026-08-19T18:00:00+08:00",
    list_id: 1,
    project_id: null,
    created_at: "2026-08-18T09:00:00+08:00",
    updated_at: "2026-08-19T11:00:00+08:00",
    ...over,
  };
}

describe("shouldListCompletedActivity", () => {
  test("须 status=completed 且带 completed_on*", async () => {
    const { shouldListCompletedActivity } = await import("./completed-activity.ts");
    expect(shouldListCompletedActivity(undefined)).toBe(false);
    expect(shouldListCompletedActivity({ status: "completed" })).toBe(false);
    expect(shouldListCompletedActivity({ status: "pending", completed_on: "today" })).toBe(false);
    expect(shouldListCompletedActivity({ status: "completed", completed_on: "today" })).toBe(true);
    expect(
      shouldListCompletedActivity({ status: "completed", completed_on_or_after_days: 6 }),
    ).toBe(true);
  });
});

describe("listCompletedActivity", () => {
  afterEach(() => {
    mock.restore();
  });

  test("两侧按 completed_at 降序合并，offset/limit 切在合并后", async () => {
    const itemStore = await import("./item-store.ts");
    const occStore = await import("./occurrence-store.ts");
    const listItems = spyOn(itemStore, "listTaskItems").mockImplementation(async () => [
      itemRow({ id: 10, title: "较早完成", completed_at: "2026-08-19T09:00:00+08:00" }),
      itemRow({ id: 11, title: "中间完成", completed_at: "2026-08-19T12:00:00+08:00" }),
    ]);
    spyOn(occStore, "listTaskOccurrencesByFilters").mockImplementation(async () => [
      occRow({
        id: 90,
        series_task_id: 20,
        title: "occurrence 最晚",
        completed_at: "2026-08-19T13:00:00+08:00",
      }),
    ]);

    const { listCompletedActivity } = await import("./completed-activity.ts");
    const rows = await listCompletedActivity(
      1,
      { status: "completed", completed_on: "today" },
      { limit: 2, offset: 0 },
    );

    expect(listItems).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        filters: { status: "completed", completed_on: "today" },
        limit: 2,
        offset: 0,
      }),
    );
    expect(rows.map((r) => r.title)).toEqual(["occurrence 最晚", "中间完成"]);
    expect(rows[0]?.id).toBe(20);
    expect(rows[0]?.occurrence_id).toBe(90);
    expect(rows[0]?.recurrence).toBeNull();
    expect(rows[0]?.due_at).toBe("2026-08-19T18:00:00+08:00");
  });

  test("offset 切在合并后而非两侧各切", async () => {
    const itemStore = await import("./item-store.ts");
    const occStore = await import("./occurrence-store.ts");
    const listItems = spyOn(itemStore, "listTaskItems").mockImplementation(async () => [
      itemRow({ id: 1, title: "c", completed_at: "2026-08-19T10:00:00+08:00" }),
      itemRow({ id: 2, title: "a", completed_at: "2026-08-19T12:00:00+08:00" }),
    ]);
    spyOn(occStore, "listTaskOccurrencesByFilters").mockImplementation(async () => [
      occRow({
        id: 80,
        series_task_id: 3,
        title: "b",
        completed_at: "2026-08-19T11:00:00+08:00",
      }),
    ]);

    const { listCompletedActivity } = await import("./completed-activity.ts");
    const rows = await listCompletedActivity(
      1,
      { status: "completed", completed_on_or_after_days: 6 },
      { limit: 2, offset: 1 },
    );
    expect(rows.map((r) => r.title)).toEqual(["b", "c"]);
    expect(listItems.mock.calls[0]?.[1]?.offset).toBe(0);
    expect(listItems.mock.calls[0]?.[1]?.limit).toBe(3);
  });

  test("同分 completed_at 用 occurrence_id 打破平局", async () => {
    const itemStore = await import("./item-store.ts");
    const occStore = await import("./occurrence-store.ts");
    spyOn(itemStore, "listTaskItems").mockImplementation(async () => [
      itemRow({ id: 5, title: "item", completed_at: "2026-08-19T10:00:00+08:00" }),
    ]);
    spyOn(occStore, "listTaskOccurrencesByFilters").mockImplementation(async () => [
      occRow({
        id: 99,
        series_task_id: 5,
        title: "occ",
        completed_at: "2026-08-19T10:00:00+08:00",
      }),
    ]);

    const { listCompletedActivity } = await import("./completed-activity.ts");
    const rows = await listCompletedActivity(1, {
      status: "completed",
      completed_on: "today",
    });
    expect(rows[0]?.title).toBe("occ");
    expect(rows[1]?.title).toBe("item");
  });
});
