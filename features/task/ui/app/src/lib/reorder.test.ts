import { describe, expect, it } from "bun:test";

import { reorderIds, sortOrderUpdates } from "./reorder.ts";

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
});
