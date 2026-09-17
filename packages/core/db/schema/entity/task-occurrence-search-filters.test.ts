import { describe, expect, test } from "bun:test";

import { parseTaskOccurrenceSearchFilters } from "./task-occurrence-search-filters.ts";

describe("parseTaskOccurrenceSearchFilters", () => {
  test("解析 completed_on / completed_on_or_after_days / in_backlog", () => {
    const parsed = parseTaskOccurrenceSearchFilters({
      completed_on: "today",
      completed_on_or_after_days: 6,
      in_backlog: true,
      list_id: 3,
    });
    expect(parsed.completed_on).toBe("today");
    expect(parsed.completed_on_or_after_days).toBe(6);
    expect(parsed.in_backlog).toBe(true);
    expect(parsed.list_id).toBe(3);
  });

  test("空对象返回 {}", () => {
    expect(parseTaskOccurrenceSearchFilters(undefined)).toEqual({});
    expect(parseTaskOccurrenceSearchFilters({})).toEqual({});
  });

  test("拒绝负数天数与未知字段", () => {
    expect(() => parseTaskOccurrenceSearchFilters({ completed_on_or_after_days: -1 })).toThrow(
      /invalid task_occurrence filters/,
    );
    expect(() => parseTaskOccurrenceSearchFilters({ foo: 1 })).toThrow(
      /invalid task_occurrence filters/,
    );
  });
});
