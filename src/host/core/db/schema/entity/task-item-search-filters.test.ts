import { describe, expect, test } from "bun:test";

import { parseTaskItemSearchFilters } from "./task-item-search-filters.ts";

describe("taskItemSearchFilters list_ids", () => {
  test("解析多清单 filters", () => {
    const parsed = parseTaskItemSearchFilters({
      status: "pending",
      list_ids: [1, 3, 5],
    });
    expect(parsed.list_ids).toEqual([1, 3, 5]);
  });

  test("拒绝空 list_ids", () => {
    expect(() => parseTaskItemSearchFilters({ list_ids: [] })).toThrow();
  });
});
