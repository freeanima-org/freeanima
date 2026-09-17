import { afterEach, describe, expect, it } from "bun:test";

import {
  normalizeShellModuleOrder,
  readShellModuleOrder,
  resetShellModuleOrderForTest,
  writeShellModuleOrder,
} from "./shell-module-order.ts";
import { SHELL_MODULE_IDS, type ShellModuleId } from "./shell-module-visibility.ts";

afterEach(() => {
  resetShellModuleOrderForTest();
});

describe("normalizeShellModuleOrder", () => {
  it("缺省返回全部模块", () => {
    expect(normalizeShellModuleOrder([])).toEqual([...SHELL_MODULE_IDS]);
  });

  it("过滤非法 ID 并补齐缺失模块", () => {
    const result = normalizeShellModuleOrder(["settings", "chat", "invalid" as "chat"]);
    expect(result).toContain("chat");
    expect(result).toContain("settings");
    expect(result).toHaveLength(SHELL_MODULE_IDS.length);
    expect(result[0]).toBe("settings");
    expect(result[1]).toBe("chat");
  });

  it("去重", () => {
    const result = normalizeShellModuleOrder(["chat", "chat", "tasks"]);
    expect(result.filter((id) => id === "chat")).toHaveLength(1);
    expect(result.indexOf("tasks")).toBe(1);
  });
});

describe("readShellModuleOrder / writeShellModuleOrder", () => {
  it("round-trip 持久化", () => {
    const custom: ShellModuleId[] = [
      "settings",
      "chat",
      "tasks",
      ...SHELL_MODULE_IDS.filter((id) => id !== "settings" && id !== "chat" && id !== "tasks"),
    ];
    writeShellModuleOrder(custom);
    expect(readShellModuleOrder()).toEqual(normalizeShellModuleOrder(custom));
  });

  it("未写入时返回默认顺序", () => {
    expect(readShellModuleOrder()).toEqual([...SHELL_MODULE_IDS]);
  });
});
