import { describe, expect, test } from "bun:test";

import { findBuiltinSmartListByPreset, listBuiltinSmartListRows } from "./smart-list-presets.ts";

describe("smart-list-presets", () => {
  test("内置 preset 仅保留完成类", () => {
    const rows = listBuiltinSmartListRows();
    expect(rows.map((row) => row.preset)).toEqual(["done_today", "done_yesterday", "done_last_7d"]);
    for (const row of rows) {
      expect(row.filters).toBeDefined();
      expect(Object.keys(row.filters).length).toBeGreaterThan(0);
      expect(row.filters.status).toBe("completed");
    }
  });

  test("到期类 preset 已移除", () => {
    expect(findBuiltinSmartListByPreset("due_today")).toBeUndefined();
    expect(findBuiltinSmartListByPreset("due_tomorrow")).toBeUndefined();
    expect(findBuiltinSmartListByPreset("due_next_7d")).toBeUndefined();
  });
});
