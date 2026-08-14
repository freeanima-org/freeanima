import { describe, expect, it } from "bun:test";

import { SORT_ORDER_STEP, reorderIds, sortOrderUpdates } from "./reorder.ts";

describe("reorderIds", () => {
  const sample = [
    { id: 1, sort_order: 0 },
    { id: 2, sort_order: 1 },
    { id: 3, sort_order: 2 },
  ];

  it("moves item before target", () => {
    const next = reorderIds(sample, 3, 1);
    expect(next.map((x) => x.id)).toEqual([3, 1, 2]);
  });

  it("appends when target is null", () => {
    const next = reorderIds(sample, 1, null);
    expect(next.map((x) => x.id)).toEqual([2, 3, 1]);
  });
});

describe("sortOrderUpdates", () => {
  it("单次搬移有空隙时只改一项", () => {
    const updates = sortOrderUpdates([
      { id: 20, sort_order: 0 },
      { id: 10, sort_order: 10 },
    ]);
    // 旧序 10@10? Wait: byOld sorts by sort_order: 20@0, 10@10 → old [20,10], new [20,10] same → already strictly increasing
    expect(updates).toEqual([]);
  });

  it("交换两项：只 patch 搬移项", () => {
    const updates = sortOrderUpdates([
      { id: 10, sort_order: 10 },
      { id: 20, sort_order: 0 },
    ]);
    // 旧 20@0, 10@10 → 新 10,20：10 移到最前，next=0 → -STEP
    expect(updates).toEqual([{ id: 10, sort_order: -SORT_ORDER_STEP }]);
  });

  it("无空隙 densify 为 STEP 间距", () => {
    const ordered = [
      { id: 1, sort_order: 0 },
      { id: 3, sort_order: 5 },
      { id: 2, sort_order: 1 },
    ];
    expect(sortOrderUpdates(ordered)).toEqual([
      { id: 3, sort_order: SORT_ORDER_STEP },
      { id: 2, sort_order: 2 * SORT_ORDER_STEP },
    ]);
  });
});
