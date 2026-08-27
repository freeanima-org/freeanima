import { describe, expect, test } from "bun:test";

import {
  readShellModuleVisibility,
  resetShellModuleVisibilityForTest,
  SHELL_MODULE_LOCKED,
  SHELL_MODULE_IDS,
  writeShellModuleVisibility,
} from "./shell-module-visibility.ts";

describe("shell-module-visibility", () => {
  test("缺省全部可见", () => {
    resetShellModuleVisibilityForTest();
    const visible = readShellModuleVisibility();
    expect(visible.size).toBe(SHELL_MODULE_IDS.length);
    for (const id of SHELL_MODULE_IDS) {
      expect(visible.has(id)).toBe(true);
    }
  });

  test("写入后持久化 round-trip", () => {
    resetShellModuleVisibilityForTest();
    const next = new Set<(typeof SHELL_MODULE_IDS)[number]>(["chat", "tasks", "settings"]);
    writeShellModuleVisibility(next);
    const visible = readShellModuleVisibility();
    expect(visible.has("chat")).toBe(true);
    expect(visible.has("tasks")).toBe(true);
    expect(visible.has("settings")).toBe(true);
    expect(visible.has("email")).toBe(false);
    for (const locked of SHELL_MODULE_LOCKED) {
      expect(visible.has(locked)).toBe(true);
    }
  });

  test("锁定模块不可从可见集移除", () => {
    resetShellModuleVisibilityForTest();
    writeShellModuleVisibility(new Set(["tasks"]));
    const visible = readShellModuleVisibility();
    expect(visible.has("chat")).toBe(true);
    expect(visible.has("settings")).toBe(true);
    expect(visible.has("tasks")).toBe(true);
  });

  test("bedroom / rooms / health 可取消勾选", () => {
    resetShellModuleVisibilityForTest();
    const withoutOptional = new Set<(typeof SHELL_MODULE_IDS)[number]>(
      SHELL_MODULE_IDS.filter((id) => id !== "bedroom" && id !== "rooms" && id !== "health"),
    );
    writeShellModuleVisibility(withoutOptional);
    const visible = readShellModuleVisibility();
    expect(visible.has("bedroom")).toBe(false);
    expect(visible.has("rooms")).toBe(false);
    expect(visible.has("health")).toBe(false);
    expect(visible.has("chat")).toBe(true);
  });

  test("旧可见集不含新模块时一次性补全 bedroom / rooms / health", () => {
    const backing = new Map<string, string>();
    const mockStorage: Storage = {
      get length() {
        return backing.size;
      },
      clear: () => backing.clear(),
      getItem: (key) => backing.get(key) ?? null,
      key: (index) => [...backing.keys()][index] ?? null,
      setItem: (key, value) => {
        backing.set(key, value);
      },
      removeItem: (key) => {
        backing.delete(key);
      },
    };
    const hadLocalStorage = "localStorage" in globalThis;
    const origLocalStorage = hadLocalStorage ? globalThis.localStorage : undefined;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: mockStorage,
    });
    try {
      resetShellModuleVisibilityForTest();
      localStorage.setItem(
        "freeanima.shell-modules.visible",
        JSON.stringify(["chat", "tasks", "settings"]),
      );
      const visible = readShellModuleVisibility();
      expect(visible.has("bedroom")).toBe(true);
      expect(visible.has("rooms")).toBe(true);
      expect(visible.has("health")).toBe(true);
      expect(localStorage.getItem("freeanima.shell-modules.v2-new-modules")).toBe("1");
    } finally {
      if (hadLocalStorage) {
        Object.defineProperty(globalThis, "localStorage", {
          configurable: true,
          value: origLocalStorage,
        });
      } else {
        Reflect.deleteProperty(globalThis, "localStorage");
      }
    }
  });
});
