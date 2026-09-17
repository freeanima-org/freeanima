import { describe, expect, test } from "bun:test";

import { applyShiftRangeSelect } from "./range-select.ts";

describe("applyShiftRangeSelect", () => {
  const order = [10, 11, 12, 13, 14];

  test("adds range from anchor to target", () => {
    const next = applyShiftRangeSelect(new Set([10]), order, 10, 13);
    expect([...next].toSorted((a, b) => a - b)).toEqual([10, 11, 12, 13]);
  });

  test("works when target is before anchor", () => {
    const next = applyShiftRangeSelect(new Set(), order, 13, 11);
    expect([...next].toSorted((a, b) => a - b)).toEqual([11, 12, 13]);
  });

  test("without anchor adds target only", () => {
    const next = applyShiftRangeSelect(new Set(), order, null, 12);
    expect([...next]).toEqual([12]);
  });
});
