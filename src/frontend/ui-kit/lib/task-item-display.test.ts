import { describe, expect, test } from "bun:test";

import {
  resolveTaskTagTitles,
  splitTaskTagTitlesForDisplay,
  TASK_ROW_TAG_MAX_VISIBLE,
} from "./task-item-display.ts";

describe("resolveTaskTagTitles", () => {
  test("returns empty without lookup or ids", () => {
    expect(resolveTaskTagTitles([1], null)).toEqual([]);
    expect(resolveTaskTagTitles([], new Map([[1, "a"]]))).toEqual([]);
  });

  test("skips missing ids and preserves order", () => {
    const map = new Map([
      [2, "beta"],
      [1, "alpha"],
    ]);
    expect(resolveTaskTagTitles([1, 9, 2], map)).toEqual(["alpha", "beta"]);
  });
});

describe("splitTaskTagTitlesForDisplay", () => {
  test("shows all when within limit", () => {
    expect(splitTaskTagTitlesForDisplay(["a", "b"])).toEqual({
      visible: ["a", "b"],
      overflowCount: 0,
    });
  });

  test("caps visible and reports overflow", () => {
    expect(splitTaskTagTitlesForDisplay(["a", "b", "c", "d"])).toEqual({
      visible: ["a", "b"],
      overflowCount: 2,
    });
    expect(TASK_ROW_TAG_MAX_VISIBLE).toBe(2);
  });

  test("respects custom maxVisible", () => {
    expect(splitTaskTagTitlesForDisplay(["a", "b", "c"], 1)).toEqual({
      visible: ["a"],
      overflowCount: 2,
    });
  });
});
