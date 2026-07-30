import { describe, expect, it } from "bun:test";
import { expandToolNames, formatToolsForToolMessage, searchToolsetsCatalog } from "./catalog.ts";
import { ToolSetRegistry } from "./toolset.ts";

function testRegistry(): ToolSetRegistry {
  const registry = new ToolSetRegistry();
  registry.registerToolSet("file", "files", [
    {
      name: "file_read",
      description: "Read file",
      parameters: { type: "object", properties: { path: { type: "string" } } },
      handler: () => "ok",
    },
    {
      name: "file_write",
      description: "Write file",
      parameters: { type: "object", properties: {} },
      handler: () => "ok",
    },
  ]);
  registry.registerToolSet("tools", "catalog", [
    {
      name: "tools_list",
      description: "List tools",
      parameters: { type: "object", properties: {} },
      handler: () => "ok",
    },
  ]);
  return registry;
}

describe("expandToolNames", () => {
  it("expands @toolset", () => {
    const registry = testRegistry();
    expect(expandToolNames(registry, ["@file"])).toEqual(["file_read", "file_write"]);
  });
});

describe("searchToolsetsCatalog", () => {
  it("matches toolsets by AND tokens", () => {
    const registry = testRegistry();
    const hit = searchToolsetsCatalog(registry, "read file");
    expect(hit.hits.some((h) => h.toolset === "file")).toBe(true);
  });
});

describe("formatToolsForToolMessage", () => {
  it("returns full parameters", () => {
    const registry = testRegistry();
    const formatted = formatToolsForToolMessage(registry, ["file_read"]);
    expect(formatted).toHaveLength(1);
    expect(formatted[0]?.parameters).toEqual({
      type: "object",
      properties: {
        _title: {
          type: "string",
          description:
            'One-line intent of this call for UI (e.g. "修改配置文件", "merger 10054 pr")',
        },
        path: { type: "string" },
      },
      required: ["_title"],
    });
  });

  it("includes return_schema when ToolDef has returnSchema", () => {
    const registry = new ToolSetRegistry();
    const returnSchema = {
      type: "object",
      properties: { ok: { type: "boolean" } },
    };
    registry.registerToolSet("file", "files", [
      {
        name: "file_read",
        description: "Read file",
        parameters: { type: "object", properties: {} },
        returnSchema,
        handler: () => "ok",
      },
    ]);
    const formatted = formatToolsForToolMessage(registry, ["file_read"]);
    expect(formatted[0]?.return_schema).toEqual(returnSchema);
  });

  it("omits return_schema when ToolDef has none", () => {
    const registry = testRegistry();
    const formatted = formatToolsForToolMessage(registry, ["file_read"]);
    expect(formatted[0]).not.toHaveProperty("return_schema");
  });
});
