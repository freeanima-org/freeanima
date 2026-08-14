import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { loadAutoSpeakPref, saveAutoSpeakPref } from "./auto-speak-pref.ts";

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
      return map.has(key) ? (map.get(key) ?? null) : null;
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

describe("auto-speak-pref", () => {
  const prev = globalThis.localStorage;

  beforeEach(() => {
    globalThis.localStorage = mockLocalStorage();
  });

  afterEach(() => {
    globalThis.localStorage = prev;
  });

  it("默认关闭", () => {
    expect(loadAutoSpeakPref()).toBe(false);
  });

  it("可持久化开启与关闭", () => {
    saveAutoSpeakPref(true);
    expect(loadAutoSpeakPref()).toBe(true);
    saveAutoSpeakPref(false);
    expect(loadAutoSpeakPref()).toBe(false);
  });
});
