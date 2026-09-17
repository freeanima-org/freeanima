import { describe, expect, test } from "bun:test";

import type { TaskItemRowPayload } from "@freeanima/shared/rpc-contract/frames/task.ts";

import { normalizeTaskItemRow, normalizeTaskItemRows } from "./normalize-task-item.ts";

const base = {
  id: 1,
  title: "t",
  content: "",
  status: "pending",
  priority: "none",
  due_at: null,
  remind_at: null,
  list_id: 2,
  project_id: null,
  sort_order: 0,
  completed_at: null,
  primary_component: "task_item",
  created_at: "2026-07-19T00:00:00.000Z",
  updated_at: "2026-07-19T00:00:00.000Z",
} as TaskItemRowPayload;

describe("normalizeTaskItemRows", () => {
  test("returns empty array when items is nullish", () => {
    expect(normalizeTaskItemRows(undefined)).toEqual([]);
    expect(normalizeTaskItemRows(null)).toEqual([]);
  });

  test("fills missing tag_ids on each row", () => {
    const row = { ...base, tag_ids: undefined as unknown as number[] };
    expect(normalizeTaskItemRows([row])).toEqual([{ ...base, tag_ids: [] }]);
  });

  test("defaults missing primary_component to task_item", () => {
    const row = {
      ...base,
      primary_component: undefined as unknown as string,
    };
    expect(normalizeTaskItemRows([row])[0]?.primary_component).toBe("task_item");
  });
});

describe("normalizeTaskItemRow", () => {
  test("preserves existing tag_ids", () => {
    expect(normalizeTaskItemRow({ ...base, tag_ids: [3, 4] }).tag_ids).toEqual([3, 4]);
  });
});
