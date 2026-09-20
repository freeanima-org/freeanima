import { describe, expect, it } from "bun:test";

import { isTaskItemDisplayDirty } from "@freeanima/ui-kit/lib/task-item-display.ts";
import type { TaskItemRow } from "./api.ts";

const base: TaskItemRow = {
  id: 1,
  title: "t",
  content: "c",
  tag_ids: [1, 2],
  status: "pending",
  priority: "none",
  due_at: null,
  remind_at: null,
  list_id: 10,
  project_id: null,
  sort_order: 0,
  completed_at: null,
  primary_component: "task_item",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("isTaskItemDisplayDirty", () => {
  it("same tag_ids order is clean", () => {
    expect(isTaskItemDisplayDirty(base, { ...base, tag_ids: [...base.tag_ids] })).toBe(false);
  });

  it("reordered tag_ids is dirty", () => {
    expect(isTaskItemDisplayDirty({ ...base, tag_ids: [2, 1] }, base)).toBe(true);
  });
});
