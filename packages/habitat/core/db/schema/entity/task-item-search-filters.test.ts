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

describe("taskItemSearchFilters 日期字段", () => {
  test("解析 due_on_or_before_days: 0 与 completed_on", () => {
    const parsed = parseTaskItemSearchFilters({
      due_on_or_before_days: 0,
      completed_on: "today",
      completed_on_or_after_days: 6,
    });
    expect(parsed.due_on_or_before_days).toBe(0);
    expect(parsed.completed_on).toBe("today");
    expect(parsed.completed_on_or_after_days).toBe(6);
  });

  test("拒绝负数天数", () => {
    expect(() => parseTaskItemSearchFilters({ due_on_or_before_days: -1 })).toThrow(
      /invalid task_item filters/,
    );
    expect(() => parseTaskItemSearchFilters({ completed_on_or_after_days: -1 })).toThrow(
      /invalid task_item filters/,
    );
  });
});
