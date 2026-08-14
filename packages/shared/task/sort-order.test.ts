import { describe, expect, it } from "bun:test";

import {
  SORT_ORDER_STEP,
  PG_INT32_MAX,
  applySortOrderUpdates,
  clampSortOrder,
  nextPrependSortOrder,
  sortOrderUpdates,
} from "@freeanima/shared/task/sort-order.ts";

describe("clampSortOrder", () => {
  it("钳到 PG int4", () => {
    expect(clampSortOrder(2281701376)).toBe(PG_INT32_MAX);
    expect(clampSortOrder(-3_000_000_000)).toBe(-2_147_483_648);
    expect(clampSortOrder(42.9)).toBe(42);
    expect(clampSortOrder(Number.NaN)).toBe(0);
  });
});

describe("nextPrependSortOrder", () => {
  it("空列表为 0，否则 min - STEP", () => {
    expect(nextPrependSortOrder([])).toBe(0);
    expect(nextPrependSortOrder([0, 10, 20])).toBe(-SORT_ORDER_STEP);
    expect(nextPrependSortOrder([-10, 0])).toBe(-20);
  });
});

describe("sortOrderUpdates spaced", () => {
  it("已严格递增则无需 patch", () => {
    expect(
      sortOrderUpdates([
        { id: 1, sort_order: 0 },
        { id: 2, sort_order: 10 },
        { id: 3, sort_order: 20 },
      ]),
    ).toEqual([]);
  });

  it("单次搬移有空隙时只改一项", () => {
    const ordered = [
      { id: 3, sort_order: 30 },
      { id: 1, sort_order: 0 },
      { id: 2, sort_order: 10 },
      { id: 4, sort_order: 20 },
    ];
    // 旧序 1,2,4,3 → 新序 3,1,2,4：3 插到最前
    expect(sortOrderUpdates(ordered)).toEqual([{ id: 3, sort_order: -SORT_ORDER_STEP }]);
  });

  it("搬到两邻居之间取中点", () => {
    const ordered = [
      { id: 1, sort_order: 0 },
      { id: 3, sort_order: 30 },
      { id: 2, sort_order: 10 },
      { id: 4, sort_order: 20 },
    ];
    // 旧 1,2,4,3 → 1,3,2,4：3 插到 1 与 2 之间
    expect(sortOrderUpdates(ordered)).toEqual([{ id: 3, sort_order: 5 }]);
  });

  it("无整数空隙时整表按 STEP densify", () => {
    const ordered = [
      { id: 2, sort_order: 1 },
      { id: 1, sort_order: 0 },
      { id: 3, sort_order: 2 },
    ];
    // 旧 1,2,3 dense；2 移到最前，prev=null next=0 → -STEP，仍有空隙
    expect(sortOrderUpdates(ordered)).toEqual([{ id: 2, sort_order: -SORT_ORDER_STEP }]);

    const noGap = [
      { id: 3, sort_order: 2 },
      { id: 1, sort_order: 0 },
      { id: 2, sort_order: 1 },
    ];
    // 3 插到最前：next=0，candidate=-10，有空隙
    expect(sortOrderUpdates(noGap)).toEqual([{ id: 3, sort_order: -SORT_ORDER_STEP }]);

    // 相邻整数间插入：0 与 1 之间无空隙 → densify
    const squeeze = [
      { id: 1, sort_order: 0 },
      { id: 3, sort_order: 5 },
      { id: 2, sort_order: 1 },
    ];
    expect(sortOrderUpdates(squeeze)).toEqual([
      { id: 3, sort_order: SORT_ORDER_STEP },
      { id: 2, sort_order: 2 * SORT_ORDER_STEP },
    ]);
  });

  it("applySortOrderUpdates 只改 patch 中的行", () => {
    const rows = [
      { id: 1, sort_order: 0 },
      { id: 2, sort_order: 10 },
    ];
    expect(applySortOrderUpdates(rows, [{ id: 2, sort_order: -10 }])).toEqual([
      { id: 1, sort_order: 0 },
      { id: 2, sort_order: -10 },
    ]);
  });
});
