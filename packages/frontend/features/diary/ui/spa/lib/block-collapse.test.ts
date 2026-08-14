import { beforeEach, describe, expect, it } from "bun:test";

import { firstContentParagraph, isBlockCollapsed, setBlockCollapsed } from "./block-collapse.ts";

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

describe("block-collapse", () => {
  const prev = globalThis.localStorage;

  beforeEach(() => {
    globalThis.localStorage = mockLocalStorage();
  });

  it("默认展开", () => {
    expect(isBlockCollapsed(1)).toBe(false);
  });

  it("读写收起状态", () => {
    setBlockCollapsed(7, true);
    expect(isBlockCollapsed(7)).toBe(true);
    setBlockCollapsed(7, false);
    expect(isBlockCollapsed(7)).toBe(false);
  });

  it("取正文第一段", () => {
    expect(firstContentParagraph("\n  hello\nworld")).toBe("hello");
    expect(firstContentParagraph("")).toBe("");
  });

  // restore after suite via last test cleanup
  it("restore localStorage", () => {
    globalThis.localStorage = prev;
  });
});
