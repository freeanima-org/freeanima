import { afterEach, describe, expect, it } from "bun:test";

import {
  adjustColumnSplit,
  clampColumnWidth,
  readColumnSplits,
  resolveColumnSplits,
  writeColumnSplits,
  type ColumnSplits,
} from "./column-split.ts";

function mockLocalStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe("column-split", () => {
  const prevStorage = globalThis.localStorage;

  afterEach(() => {
    globalThis.localStorage = prevStorage;
  });

  it("clampColumnWidth 限制区间", () => {
    expect(clampColumnWidth(100, 180, 480)).toBe(180);
    expect(clampColumnWidth(500, 180, 480)).toBe(480);
    expect(clampColumnWidth(300, 180, 480)).toBe(300);
  });

  it("读写 localStorage", () => {
    globalThis.localStorage = mockLocalStorage();
    writeColumnSplits("task", { list: 300, middle: 360 });
    expect(readColumnSplits("task")).toEqual({ list: 300, middle: 360 });
    expect(resolveColumnSplits("task", { list: 256, middle: 320 }).list).toBe(300);
  });

  it("adjustColumnSplit 连续增量应累加", () => {
    const defaults = { list: 256, middle: 320 };
    let current: ColumnSplits = { list: 256, middle: 320 };
    current = adjustColumnSplit(current, "list", 8, defaults);
    current = adjustColumnSplit(current, "list", 8, defaults);
    expect(current.list).toBe(272);
    expect(current.middle).toBe(320);
  });
});
