import { describe, expect, it } from "bun:test";

import { SORT_ORDER_STEP, sortOrderUpdates } from "./reorder.ts";

describe("sortOrderUpdates", () => {
  it("交换两项：只 patch 搬移项", () => {
    const updates = sortOrderUpdates([
      { id: 10, sort_order: 10 },
      { id: 20, sort_order: 0 },
    ]);
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
