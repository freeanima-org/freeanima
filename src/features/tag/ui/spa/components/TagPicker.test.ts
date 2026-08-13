import { describe, expect, it } from "bun:test";

import { DIARY_ENTRY_COMPONENT, TASK_ITEM_COMPONENT } from "@freeanima/shared/entity-shapes";

import { moveNavIndex, navTargetCount } from "./TagPicker.tsx";

/** 壳层（Popover / ModalSheetPresent）不在此测；仅覆盖导航与新建判定纯逻辑。 */
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

describe("TagPicker 键盘导航索引", () => {
  it("navTargetCount 含候选项与可选添加按钮", () => {
    expect(navTargetCount(0, false)).toBe(0);
    expect(navTargetCount(3, false)).toBe(3);
    expect(navTargetCount(3, true)).toBe(4);
    expect(navTargetCount(0, true)).toBe(1);
  });

  it("ArrowDown：输入框 → 候选项 → 添加 → 回到输入框", () => {
    // 2 候选项 + 添加：-1 → 0 → 1 → 2 → -1
    expect(moveNavIndex(-1, 1, 2, true)).toBe(0);
    expect(moveNavIndex(0, 1, 2, true)).toBe(1);
    expect(moveNavIndex(1, 1, 2, true)).toBe(2);
    expect(moveNavIndex(2, 1, 2, true)).toBe(-1);
  });

  it("ArrowUp：反向环绕", () => {
    expect(moveNavIndex(-1, -1, 2, true)).toBe(2);
    expect(moveNavIndex(2, -1, 2, true)).toBe(1);
    expect(moveNavIndex(0, -1, 2, true)).toBe(-1);
  });

  it("无候选项仅添加按钮", () => {
    expect(moveNavIndex(-1, 1, 0, true)).toBe(0);
    expect(moveNavIndex(0, 1, 0, true)).toBe(-1);
    expect(moveNavIndex(-1, -1, 0, true)).toBe(0);
  });

  it("无可导航目标时保持输入框", () => {
    expect(moveNavIndex(-1, 1, 0, false)).toBe(-1);
    expect(moveNavIndex(0, 1, 0, false)).toBe(-1);
  });
});
