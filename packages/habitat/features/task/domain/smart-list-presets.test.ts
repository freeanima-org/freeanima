import { describe, expect, test } from "bun:test";

import { findBuiltinSmartListByPreset, listBuiltinSmartListRows } from "./smart-list-presets.ts";

describe("smart-list-presets", () => {
  test("内置完成类智能清单已退役", () => {
    const rows = listBuiltinSmartListRows();
    expect(rows).toEqual([]);
    expect(findBuiltinSmartListByPreset("done_today")).toBeUndefined();
  });
});
