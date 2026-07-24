import { describe, expect, it } from "bun:test";

import { DIARY_ENTRY_COMPONENT, TASK_ITEM_COMPONENT } from "@freeanima/core/db/schema";

/** 纯逻辑：是否展示「添加「q」」（无精确标题命中） */
function shouldShowCreate(
  query: string,
  items: Array<{ title: string }>,
  pool: Array<{ title: string }>,
): boolean {
  const q = query.trim();
  if (q.length === 0) return false;
  const lower = q.toLowerCase();
  if (items.some((row) => row.title.toLowerCase() === lower)) return false;
  if (pool.some((row) => row.title.toLowerCase() === lower)) return false;
  return true;
}

describe("TagPicker showCreate", () => {
  it("空输入不显示新建", () => {
    expect(shouldShowCreate("", [], [])).toBe(false);
    expect(shouldShowCreate("  ", [], [])).toBe(false);
  });

  it("列表或 pool 已有精确标题则不显示", () => {
    expect(shouldShowCreate("日常", [{ title: "日常" }], [])).toBe(false);
    expect(shouldShowCreate("日常", [], [{ title: "日常" }])).toBe(false);
    expect(shouldShowCreate("日常", [{ title: "日报" }], [{ title: "日常" }])).toBe(false);
  });

  it("无精确命中时显示新建", () => {
    expect(shouldShowCreate("新标签", [{ title: "日常" }], [{ title: "工作" }])).toBe(true);
  });

  it("场景 primary_component 常量可用于挂标签", () => {
    expect(DIARY_ENTRY_COMPONENT).toBe("diary_entry");
    expect(TASK_ITEM_COMPONENT).toBe("task_item");
  });
});
