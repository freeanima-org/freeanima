import { describe, expect, it } from "bun:test";
import { ToolSetRegistry } from "./index.ts";

const sampleTool = {
  name: "test_tool",
  description: "Test tool",
  parameters: { type: "object", properties: {} },
  handler: () => '{"ok":true}',
};

describe("ToolSetRegistry", () => {
  it("getToolSet / listToolSets return frozen ToolSet after registerToolSet", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("browser", "Browser automation", [
      { ...sampleTool, name: "browser_navigate" },
      { ...sampleTool, name: "browser_click" },
    ]);
    const ts = registry.getToolSet("browser");
    expect(ts).toBeDefined();
    expect(ts?.description).toBe("Browser automation");
    expect(ts?.tools.map((t) => t.name)).toEqual(["browser_navigate", "browser_click"]);
    expect(Object.isFrozen(ts)).toBe(true);
    expect(Object.isFrozen(ts?.tools)).toBe(true);
    expect(registry.listToolSets()).toHaveLength(1);
    expect(registry.listToolSets()[0]?.tools).toEqual(["browser_navigate", "browser_click"]);
  });

  it("duplicate registerToolSet same name throws", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("local", "Local tools", [{ ...sampleTool, name: "read_file" }]);
    expect(() =>
      registry.registerToolSet("local", "duplicate", [{ ...sampleTool, name: "write_file" }]),
    ).toThrow("ToolSet 'local' already registered");
  });

  it("tools array is snapshot; mutating source after registerToolSet does not affect ToolSet", () => {
    const registry = new ToolSetRegistry();
    const defs = [
      { ...sampleTool, name: "a" },
      { ...sampleTool, name: "b" },
    ];
    registry.registerToolSet("snap", "snapshot", defs);
    defs.push({ ...sampleTool, name: "c" });
    expect(registry.getToolSet("snap")?.tools.map((t) => t.name)).toEqual(["a", "b"]);
  });

  it("registerToolSet preserves tool registration order", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("a", "A", [
      { ...sampleTool, name: "x" },
      { ...sampleTool, name: "y" },
    ]);
    registry.registerToolSet("b", "B", [{ ...sampleTool, name: "z" }]);
    expect(registry.listTools().map((t) => t.name)).toEqual(["x", "y", "z"]);
  });

  it("unregisterToolSet removes set and global index", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("mcp1", "MCP", [{ ...sampleTool, name: "mcp_a" }]);
    registry.registerToolSet("local", "local", [{ ...sampleTool, name: "local_tool" }]);
    const removed = registry.unregisterToolSet("mcp1");
    expect(removed).toEqual(["mcp_a"]);
    expect(registry.listTools().map((t) => t.name)).toEqual(["local_tool"]);
    expect(registry.getToolSet("mcp1")).toBeUndefined();
  });

  it("openaiSchemas maps to function schema", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("t", "T", [sampleTool]);
    const schemas = registry.openaiSchemas();
    const params = schemas[0]?.function.parameters;
    expect(schemas[0]?.function.name).toBe("test_tool");
    expect(params?.required).toContain("_title");
    expect(params?.properties).toHaveProperty("_title");
  });

  it("openaiSchemasFromNames resolves schema by name", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("t", "T", [{ ...sampleTool, name: "named_tool" }]);
    expect(registry.toolNames()).toContain("named_tool");
    const schemas = registry.openaiSchemasFromNames(["named_tool", "missing_tool"]);
    expect(schemas).toHaveLength(1);
    expect(schemas[0]?.function.name).toBe("named_tool");
  });

  it("resolveToolArgs parses JSON object", () => {
    const registry = new ToolSetRegistry();
    const result = registry.resolveToolArgs('{"x":1}');
    expect(result).toEqual({ ok: true, data: { x: 1 } });
  });

  it("resolveToolArgs defaults empty args to {}", () => {
    const registry = new ToolSetRegistry();
    expect(registry.resolveToolArgs(null)).toEqual({ ok: true, data: {} });
  });

  it("duplicate tool name across ToolSets throws", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("a", "A", [{ ...sampleTool, name: "dup" }]);
    expect(() => registry.registerToolSet("b", "B", [{ ...sampleTool, name: "dup" }])).toThrow(
      "Tool 'dup' already registered",
    );
  });
});
