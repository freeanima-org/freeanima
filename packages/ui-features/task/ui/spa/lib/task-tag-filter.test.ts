import { describe, expect, test } from "bun:test";

import {
  collectTagsFromTaskItems,
  findUnresolvedTaskTagIds,
  matchTaskItemByTag,
} from "./task-tag-filter.ts";

describe("task-tag-filter", () => {
  const titleById = new Map([
    [2, "beta"],
    [1, "alpha"],
    [3, "文档"],
  ]);

  test("collectTagsFromTaskItems dedupes and sorts by title", () => {
    const items = [{ tag_ids: [2, 1] }, { tag_ids: [2, 3] }, { tag_ids: [] }];
    expect(collectTagsFromTaskItems(items, titleById)).toEqual([
      { id: 1, title: "alpha" },
      { id: 2, title: "beta" },
      { id: 3, title: "文档" },
    ]);
  });

  test("collectTagsFromTaskItems skips unresolved ids instead of showing bare numbers", () => {
    const items = [{ tag_ids: [2, 99] }, { tag_ids: [1] }];
    expect(collectTagsFromTaskItems(items, titleById)).toEqual([
      { id: 1, title: "alpha" },
      { id: 2, title: "beta" },
    ]);
  });

  test("findUnresolvedTaskTagIds lists missing ids sorted", () => {
    const items = [{ tag_ids: [99, 2] }, { tag_ids: [1, 88] }, { tag_ids: [99] }];
    expect(findUnresolvedTaskTagIds(items, titleById)).toEqual([88, 99]);
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
