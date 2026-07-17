import { describe, expect, it } from "bun:test";

import type { TaskItemRow } from "./api.ts";
import { isTaskItemDirty } from "./task-detail-dirty.ts";

const base: TaskItemRow = {
  id: 1,
  title: "标题",
  content: "内容",
  tags: ["a", "b"],
  status: "pending",
  priority: "medium",
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
  it("未修改时返回 false", () => {
    expect(isTaskItemDirty(base, { ...base, tags: [...base.tags] })).toBe(false);
  });

  it("标题变更时返回 true", () => {
    expect(isTaskItemDirty({ ...base, title: "新标题" }, base)).toBe(true);
  });

  it("标签顺序变更时返回 true", () => {
    expect(isTaskItemDirty({ ...base, tags: ["b", "a"] }, base)).toBe(true);
  });

  it("完成状态变更时返回 true", () => {
    expect(isTaskItemDirty({ ...base, status: "completed" }, base)).toBe(true);
  });
});
