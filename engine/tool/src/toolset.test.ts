import { describe, expect, it } from "bun:test";
import { ToolSetRegistry } from "./index.ts";

const sampleTool = {
  name: "test_tool",
  description: "测试工具",
  parameters: { type: "object", properties: {} },
  handler: () => '{"ok":true}',
};

describe("ToolSetRegistry", () => {
  it("registerToolSet 后 getToolSet / listToolSets 返回冻结 ToolSet", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("browser", "浏览器自动化", [
      { ...sampleTool, name: "browser_navigate" },
      { ...sampleTool, name: "browser_click" },
    ]);
    const ts = registry.getToolSet("browser");
    expect(ts).toBeDefined();
    expect(ts?.description).toBe("浏览器自动化");
    expect(ts?.tools.map((t) => t.name)).toEqual(["browser_navigate", "browser_click"]);
    expect(Object.isFrozen(ts)).toBe(true);
    expect(Object.isFrozen(ts?.tools)).toBe(true);
    expect(registry.listToolSets()).toHaveLength(1);
    expect(registry.listToolSets()[0]?.tools).toEqual(["browser_navigate", "browser_click"]);
  });

  it("重复 registerToolSet 同名 ToolSet 抛错", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("local", "本地工具", [{ ...sampleTool, name: "read_file" }]);
    expect(() =>
      registry.registerToolSet("local", "重复", [{ ...sampleTool, name: "write_file" }]),
    ).toThrow("ToolSet 'local' already registered");
  });

  it("tools 数组为快照，registerToolSet 后修改原数组不影响 ToolSet", () => {
    const registry = new ToolSetRegistry();
    const defs = [
      { ...sampleTool, name: "a" },
      { ...sampleTool, name: "b" },
    ];
    registry.registerToolSet("snap", "快照", defs);
    defs.push({ ...sampleTool, name: "c" });
    expect(registry.getToolSet("snap")?.tools.map((t) => t.name)).toEqual(["a", "b"]);
  });

  it("registerToolSet 保持工具注册顺序", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("a", "A", [
      { ...sampleTool, name: "x" },
      { ...sampleTool, name: "y" },
    ]);
    registry.registerToolSet("b", "B", [{ ...sampleTool, name: "z" }]);
    expect(registry.listTools().map((t) => t.name)).toEqual(["x", "y", "z"]);
  });

  it("unregisterToolSet 移除整集与全局索引", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("mcp1", "MCP", [{ ...sampleTool, name: "mcp_a" }]);
    registry.registerToolSet("local", "本地", [{ ...sampleTool, name: "local_tool" }]);
    const removed = registry.unregisterToolSet("mcp1");
    expect(removed).toEqual(["mcp_a"]);
    expect(registry.listTools().map((t) => t.name)).toEqual(["local_tool"]);
    expect(registry.getToolSet("mcp1")).toBeUndefined();
  });

  it("openaiSchemas 映射为 function schema", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("t", "T", [sampleTool]);
    const schemas = registry.openaiSchemas();
    expect(schemas).toEqual([
      {
        type: "function",
        function: {
          name: "test_tool",
          description: "测试工具",
          parameters: { type: "object", properties: {} },
        },
      },
    ]);
  });

  it("openaiSchemasFromNames 按名解析 schema", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("t", "T", [{ ...sampleTool, name: "named_tool" }]);
    expect(registry.toolNames()).toContain("named_tool");
    const schemas = registry.openaiSchemasFromNames(["named_tool", "missing_tool"]);
    expect(schemas).toHaveLength(1);
    expect(schemas[0]?.function.name).toBe("named_tool");
  });

  it("resolveToolArgs 解析 JSON 对象", () => {
    const registry = new ToolSetRegistry();
    const result = registry.resolveToolArgs('{"x":1}');
    expect(result).toEqual({ ok: true, data: { x: 1 } });
  });

  it("resolveToolArgs 空参数默认为 {}", () => {
    const registry = new ToolSetRegistry();
    expect(registry.resolveToolArgs(null)).toEqual({ ok: true, data: {} });
  });

  it("跨 ToolSet 重复工具名抛错", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("a", "A", [{ ...sampleTool, name: "dup" }]);
    expect(() => registry.registerToolSet("b", "B", [{ ...sampleTool, name: "dup" }])).toThrow(
      "Tool 'dup' already registered",
    );
  });
});
