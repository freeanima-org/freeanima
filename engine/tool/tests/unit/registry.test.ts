import { afterEach, describe, expect, it } from "bun:test";
import {
  ToolRegistry,
  getTool,
  listTools,
  openaiSchemas,
  registerTool,
  resolveToolArgs,
  unregisterToolsByToolset,
} from "../../src/index.ts";

const TEST_TOOLSET = "__engine_tool_test__";

const sampleTool = {
  name: "test_tool",
  description: "测试工具",
  parameters: { type: "object", properties: {} },
  handler: () => '{"ok":true}',
  toolset: TEST_TOOLSET,
};

afterEach(() => {
  unregisterToolsByToolset(TEST_TOOLSET);
});

describe("ToolRegistry", () => {
  it("register 与 list 保持注册顺序", () => {
    const registry = new ToolRegistry();
    registry.register({ ...sampleTool, name: "a" });
    registry.register({ ...sampleTool, name: "b" });
    expect(registry.list().map((t) => t.name)).toEqual(["a", "b"]);
  });

  it("重复 register 同名工具不重复入 order", () => {
    const registry = new ToolRegistry();
    registry.register(sampleTool);
    registry.register({ ...sampleTool, description: "更新" });
    expect(registry.list()).toHaveLength(1);
    expect(registry.get("test_tool")?.description).toBe("更新");
  });

  it("unregisterToolsByToolset 按 toolset 移除", () => {
    const registry = new ToolRegistry();
    registry.register({ ...sampleTool, name: "mcp_a", toolset: "mcp1" });
    registry.register({ ...sampleTool, name: "local", toolset: "local" });
    const removed = registry.unregisterToolsByToolset("mcp1");
    expect(removed).toEqual(["mcp_a"]);
    expect(registry.list().map((t) => t.name)).toEqual(["local"]);
  });

  it("openaiSchemas 映射为 function schema", () => {
    const registry = new ToolRegistry();
    registry.register(sampleTool);
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

  it("resolveToolArgs 解析 JSON 对象", () => {
    const registry = new ToolRegistry();
    const result = registry.resolveToolArgs('{"x":1}');
    expect(result).toEqual({ ok: true, data: { x: 1 } });
  });

  it("resolveToolArgs 空参数默认为 {}", () => {
    const registry = new ToolRegistry();
    expect(registry.resolveToolArgs(null)).toEqual({ ok: true, data: {} });
  });
});

describe("defaultToolRegistry 模块级函数", () => {
  it("registerTool / getTool / listTools 委托默认实例", () => {
    registerTool({ ...sampleTool, name: "mod_tool" });
    expect(getTool("mod_tool")).toBeDefined();
    expect(listTools().some((t) => t.name === "mod_tool")).toBe(true);
  });

  it("openaiSchemas 委托默认实例", () => {
    registerTool({ ...sampleTool, name: "schema_tool" });
    expect(openaiSchemas().some((s) => s.function.name === "schema_tool")).toBe(true);
  });

  it("resolveToolArgs 委托默认实例", () => {
    expect(resolveToolArgs("{}")).toEqual({ ok: true, data: {} });
  });
});
