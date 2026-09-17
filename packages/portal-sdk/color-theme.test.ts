import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  applyColorTheme,
  COLOR_THEME_IDS,
  DEFAULT_COLOR_THEME,
  parseColorTheme,
  readColorTheme,
  resetColorThemeForTest,
  writeColorTheme,
} from "./color-theme.ts";

function mockLocalStorage(): Storage {
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

function mockDocumentElement() {
  const attrs = new Map<string, string>();
  return {
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    removeAttribute(name: string) {
      attrs.delete(name);
    },
    getAttribute(name: string) {
      return attrs.get(name) ?? null;
    },
    hasAttribute(name: string) {
      return attrs.has(name);
    },
  };
}

const prevStorage = globalThis.localStorage;
const prevDocument = globalThis.document;

beforeEach(() => {
  globalThis.localStorage = mockLocalStorage();
  globalThis.document = {
    documentElement: mockDocumentElement(),
  } as unknown as Document;
});

afterEach(() => {
  resetColorThemeForTest();
  globalThis.localStorage = prevStorage;
  globalThis.document = prevDocument;
});

describe("color-theme", () => {
  test("缺省为 neutral", () => {
    expect(readColorTheme()).toBe(DEFAULT_COLOR_THEME);
  });

  test("非法值回退到 neutral", () => {
    expect(parseColorTheme("nope")).toBe("neutral");
    expect(parseColorTheme("")).toBe("neutral");
    expect(parseColorTheme(null)).toBe("neutral");
  });

  test("写入后持久化 round-trip", () => {
    writeColorTheme("ocean");
    expect(readColorTheme()).toBe("ocean");
    expect(localStorage.getItem("freeanima.color-theme")).toBe("ocean");
  });

  test("写回 neutral 清除 storage", () => {
    writeColorTheme("forest");
    writeColorTheme("neutral");
    expect(readColorTheme()).toBe("neutral");
    expect(localStorage.getItem("freeanima.color-theme")).toBeNull();
  });

  test("applyColorTheme 设置或清除 data-color-theme", () => {
    for (const id of COLOR_THEME_IDS) {
      if (id === "neutral") continue;
      applyColorTheme(id);
      expect(document.documentElement.getAttribute("data-color-theme")).toBe(id);
    }
    applyColorTheme("neutral");
    expect(document.documentElement.hasAttribute("data-color-theme")).toBe(false);
  });

  test("writeColorTheme 同步 apply DOM", () => {
    writeColorTheme("sunset");
    expect(document.documentElement.getAttribute("data-color-theme")).toBe("sunset");
  });
});
