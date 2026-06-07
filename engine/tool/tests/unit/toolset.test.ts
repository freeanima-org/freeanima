import { describe, expect, it } from "bun:test";
import { ToolSetRegistry, getToolSet, listToolSets, registerToolSet } from "../../src/index.ts";

describe("ToolSetRegistry", () => {
  it("register 后 get / list 返回冻结的 ToolSet", () => {
    const registry = new ToolSetRegistry();
    registry.register("browser", "浏览器自动化", ["browser_navigate", "browser_click"]);
    const ts = registry.get("browser");
    expect(ts).toBeDefined();
    expect(ts?.description).toBe("浏览器自动化");
    expect(ts?.tools).toEqual(["browser_navigate", "browser_click"]);
    expect(Object.isFrozen(ts)).toBe(true);
    expect(Object.isFrozen(ts?.tools)).toBe(true);
    expect(registry.list()).toHaveLength(1);
  });

  it("重复 register 同名 ToolSet 抛错", () => {
    const registry = new ToolSetRegistry();
    registry.register("local", "本地工具", ["read_file"]);
    expect(() => registry.register("local", "重复", ["write_file"])).toThrow(
      "ToolSet 'local' already registered",
    );
  });

  it("tools 数组为快照，register 后修改原数组不影响 ToolSet", () => {
    const registry = new ToolSetRegistry();
    const names = ["a", "b"];
    registry.register("snap", "快照", names);
    names.push("c");
    expect(registry.get("snap")?.tools).toEqual(["a", "b"]);
  });
});

describe("defaultToolSetRegistry 模块级函数", () => {
  it("registerToolSet / getToolSet / listToolSets 委托默认实例", () => {
    const before = listToolSets().length;
    const unique = `__toolset_test_${Date.now()}`;
    registerToolSet(unique, "测试集", ["test_tool_a"]);
    expect(getToolSet(unique)?.tools).toEqual(["test_tool_a"]);
    expect(listToolSets().length).toBe(before + 1);
  });
});
