import { describe, expect, test } from "bun:test";

import { collectTagsFromTaskItems, matchTaskItemByTag } from "./task-tag-filter.ts";

describe("task-tag-filter", () => {
  const titleById = new Map([
    [2, "beta"],
    [1, "alpha"],
  ]);

  test("collectTagsFromTaskItems dedupes and sorts by title", () => {
    const items = [{ tag_ids: [2, 1] }, { tag_ids: [2] }, { tag_ids: [] }, { tag_ids: [99] }];
    expect(collectTagsFromTaskItems(items, titleById)).toEqual([
      { id: 99, title: "99" },
      { id: 1, title: "alpha" },
      { id: 2, title: "beta" },
    ]);
  });

  test("matchTaskItemByTag treats null as all", () => {
    expect(matchTaskItemByTag({ tag_ids: [1] }, null)).toBe(true);
    expect(matchTaskItemByTag({ tag_ids: [] }, null)).toBe(true);
  });

  test("matchTaskItemByTag filters by tag id", () => {
    expect(matchTaskItemByTag({ tag_ids: [1, 2] }, 1)).toBe(true);
    expect(matchTaskItemByTag({ tag_ids: [2] }, 1)).toBe(false);
    expect(matchTaskItemByTag({ tag_ids: [] }, 1)).toBe(false);
  });
});
