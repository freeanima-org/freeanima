import { describe, expect, test } from "bun:test";

import {
  DEFAULT_SMART_LIST_PRESET,
  findBuiltinSmartListByPreset,
  listBuiltinSmartListRows,
} from "./smart-list-presets.ts";

describe("smart-list-presets", () => {
  test("内置 preset 均含 filters", () => {
    const rows = listBuiltinSmartListRows();
    expect(rows.length).toBe(6);
    for (const row of rows) {
      expect(row.filters).toBeDefined();
      expect(Object.keys(row.filters).length).toBeGreaterThan(0);
    }
  });

  test("默认回退 preset 存在", () => {
    expect(findBuiltinSmartListByPreset(DEFAULT_SMART_LIST_PRESET)?.preset).toBe("due_today");
  });
});
