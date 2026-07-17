import { describe, expect, test } from "bun:test";

import { formatDueChip } from "./datetime-local.ts";

describe("formatDueChip", () => {
  test("empty due shows placeholder", () => {
    expect(formatDueChip(null)).toEqual({ label: "截止日期", overdue: false });
    expect(formatDueChip(undefined)).toEqual({ label: "截止日期", overdue: false });
  });

  test("future due is not overdue", () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    future.setHours(12, 0, 0, 0);
    const result = formatDueChip(future.toISOString());
    expect(result.overdue).toBe(false);
    expect(result.label).toBe(`${future.getMonth() + 1}月${future.getDate()}日`);
  });

  test("past due includes 延期 days", () => {
    const past = new Date();
    past.setDate(past.getDate() - 4);
    past.setHours(12, 0, 0, 0);
    const result = formatDueChip(past.toISOString());
    expect(result.overdue).toBe(true);
    expect(result.label).toBe(`${past.getMonth() + 1}月${past.getDate()}日, 延期4天`);
  });
});
