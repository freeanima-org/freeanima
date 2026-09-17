import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { loadInputDraft, saveInputDraft } from "./input-draft.ts";

function mockSessionStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe("input-draft", () => {
  beforeEach(() => {
    globalThis.localStorage = mockSessionStorage();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test("按 conversation 读写草稿", () => {
    saveInputDraft("s1", "hello");
    expect(loadInputDraft("s1")).toBe("hello");
    expect(loadInputDraft("s2")).toBe("");
  });

  test("空文本清除草稿", () => {
    saveInputDraft("s1", "draft");
    saveInputDraft("s1", "");
    expect(loadInputDraft("s1")).toBe("");
  });
});
