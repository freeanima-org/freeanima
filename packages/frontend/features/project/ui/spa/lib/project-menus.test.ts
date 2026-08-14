import { describe, expect, it } from "bun:test";

import type { ProjectRow } from "./api.ts";
import { buildProjectMenuItems } from "./project-menus.ts";

function sampleProject(status: ProjectRow["status"]): ProjectRow {
  return {
    id: 7,
    title: "demo",
    content: "",
    folder_id: null,
    start_at: "2026-07-01T00:00:00.000Z",
    end_at: "2026-07-31T00:00:00.000Z",
    status,
    product_tag: null,
    sort_order: 0,
    task_count: 0,
    linked_diary_ids: [],
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  };
}

describe("buildProjectMenuItems", () => {
  const handlers = {
    onEdit: () => {},
    onDelete: () => {},
    onStatusChange: () => {},
    hideCompleted: false,
    onToggleHideCompleted: () => {},
  };

  it("offers hold/complete/cancel for active projects", () => {
    const labels = buildProjectMenuItems(sampleProject("active"), handlers).map((i) => i.label);
    expect(labels).toContain("搁置");
    expect(labels).toContain("完成");
    expect(labels).toContain("取消");
    expect(labels).toContain("隐藏已完成");
    expect(labels).not.toContain("重新激活");
  });

  it("offers reactivate for inactive projects", () => {
    const labels = buildProjectMenuItems(sampleProject("on_hold"), handlers).map((i) => i.label);
    expect(labels).toContain("重新激活");
    expect(labels).not.toContain("搁置");
  });

  it("toggles hide-completed label", () => {
    const labels = buildProjectMenuItems(sampleProject("active"), {
      ...handlers,
      hideCompleted: true,
    }).map((i) => i.label);
    expect(labels).toContain("显示已完成");
    expect(labels).not.toContain("隐藏已完成");
  });
});
