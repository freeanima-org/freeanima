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
});
