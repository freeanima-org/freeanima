import { describe, expect, test } from "bun:test";

import { buildObjectiveMenuItems } from "./objective-menus.ts";
import type { ObjectiveRow } from "./api.ts";

function sample(status: ObjectiveRow["status"]): ObjectiveRow {
  return {
    id: 1,
    title: "目标",
    content: "",
    parent_id: null,
    status,
    start_at: null,
    end_at: null,
    completion: { kind: "qualitative" },
    links: [],
    sort_order: 0,
    created_at: "",
    updated_at: "",
  };
}

describe("buildObjectiveMenuItems", () => {
  test("含添加子目标与其它状态", () => {
    const labels = buildObjectiveMenuItems(sample("in_progress"), {
      onAddChild: () => {},
      onStatusChange: () => {},
    }).map((i) => i.label);
    expect(labels[0]).toBe("添加子目标");
    expect(labels).toContain("设为已完成");
    expect(labels).toContain("设为未开始");
    expect(labels).not.toContain("设为进行中");
  });
});
