import { describe, expect, it } from "bun:test";

import { sortOrderUpdates } from "./reorder.ts";

describe("sortOrderUpdates", () => {
  it("returns only changed indices", () => {
    const updates = sortOrderUpdates([
      { id: 10, sort_order: 2 },
      { id: 20, sort_order: 0 },
    ]);
    expect(updates).toEqual([
      { id: 10, sort_order: 0 },
      { id: 20, sort_order: 1 },
    ]);
  });

  it("requires rows to still carry old sort_order (rewritten rows yield empty)", () => {
    const ordered = [
      { id: 1, sort_order: 1 },
      { id: 2, sort_order: 0 },
    ];
    expect(sortOrderUpdates(ordered)).toEqual([
      { id: 1, sort_order: 0 },
      { id: 2, sort_order: 1 },
    ]);
    const rewritten = ordered.map((row, index) => ({ ...row, sort_order: index }));
    expect(sortOrderUpdates(rewritten)).toEqual([]);
  });
});
