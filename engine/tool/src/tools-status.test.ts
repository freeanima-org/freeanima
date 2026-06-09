import { describe, expect, it } from "bun:test";
import { DEFAULT_SESSION_TOOL_NAMES } from "./default-session-tools.ts";
import { ToolSetRegistry } from "./toolset.ts";
import { buildToolsStatus, resolveReturnKind } from "./tools-status.ts";

describe("resolveReturnKind", () => {
  const base = {
    name: "demo_tool",
    description: "demo",
    parameters: { type: "object" },
    handler: () => "{}",
  };

  it("显式 returnKind 优先", () => {
    expect(resolveReturnKind("file", { ...base, returnKind: "json" })).toBe("json");
    expect(resolveReturnKind(undefined, { ...base, returnKind: "text" })).toBe("text");
  });

  it("mcp_ / acp_ ToolSet 推断为 text", () => {
    expect(resolveReturnKind("mcp_github", base)).toBe("text");
    expect(resolveReturnKind("acp_cursor", base)).toBe("text");
  });

  it("内置纯文本工具推断为 text", () => {
    expect(resolveReturnKind("file", { ...base, name: "file_read_file" })).toBe("text");
    expect(resolveReturnKind("terminal", { ...base, name: "terminal_run" })).toBe("text");
    expect(resolveReturnKind("code", { ...base, name: "code_execute" })).toBe("text");
  });

  it("其余默认为 json", () => {
    expect(resolveReturnKind("memory", { ...base, name: "memory_recall" })).toBe("json");
  });
});

describe("buildToolsStatus", () => {
  it("组装 definition、return_kind 与 default_tools", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("tools", "发现", [
      {
        name: "tools_list",
        description: "列出工具",
        parameters: { type: "object", properties: { query: { type: "string" } } },
        handler: () => "{}",
      },
    ]);
    registry.registerToolSet("file", "文件", [
      {
        name: "file_read_file",
        description: "读文件",
        parameters: { type: "object", properties: { path: { type: "string" } } },
        handler: () => "content",
      },
      {
        name: "file_write_file",
        description: "写文件",
        parameters: { type: "object" },
        handler: () => '{"ok":true}',
        returnSchema: { type: "object", properties: { ok: { type: "boolean" } } },
      },
    ]);
    registry.registerToolSet("mcp_demo", "MCP", [
      {
        name: "mcp_demo_ping",
        description: "MCP ping",
        parameters: { type: "object" },
        handler: () => "pong",
      },
    ]);

    const status = buildToolsStatus(registry);

    expect(status.default_tools).toEqual(
      DEFAULT_SESSION_TOOL_NAMES.filter((n) => registry.getTool(n) != null),
    );
    expect(status.default_tools).toContain("tools_list");

    const read = status.tools.find((t) => t.name === "file_read_file");
    expect(read?.return_kind).toBe("text");
    expect(read?.definition.type).toBe("function");
    expect(read?.definition.function.name).toBe("file_read_file");
    expect(read?.toolset).toBe("file");

    const write = status.tools.find((t) => t.name === "file_write_file");
    expect(write?.return_kind).toBe("json");
    expect(write?.return_schema).toEqual({
      type: "object",
      properties: { ok: { type: "boolean" } },
    });

    const mcp = status.tools.find((t) => t.name === "mcp_demo_ping");
    expect(mcp?.return_kind).toBe("text");

    expect(status.tool_sets.map((ts) => ts.name)).toEqual(["tools", "file", "mcp_demo"]);
  });
});
