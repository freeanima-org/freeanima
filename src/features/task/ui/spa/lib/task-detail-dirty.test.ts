import { describe, expect, it } from "bun:test";

import { isTaskItemDirty } from "./task-detail-dirty.ts";
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
  milestone_id: null,
  sort_order: 0,
  completed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("isTaskItemDirty", () => {
  it("same tag_ids order is clean", () => {
    expect(isTaskItemDirty(base, { ...base, tag_ids: [...base.tag_ids] })).toBe(false);
  });

  it("reordered tag_ids is dirty", () => {
    expect(isTaskItemDirty({ ...base, tag_ids: [2, 1] }, base)).toBe(true);
  });
});
