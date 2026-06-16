import { describe, expect, it } from "bun:test";
import {
  expandToolNames,
  formatToolsForToolMessage,
  listToolsCatalog,
  searchToolsetsCatalog,
  searchToolsCatalog,
} from "./catalog.ts";
import { ToolSetRegistry } from "./toolset.ts";

function testRegistry(): ToolSetRegistry {
  const registry = new ToolSetRegistry();
  registry.registerToolSet("file", "files", [
    {
      name: "file_read_file",
      description: "Read file",
      parameters: { type: "object", properties: { path: { type: "string" } } },
      handler: () => "ok",
    },
    {
      name: "file_write_file",
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
    expect(expandToolNames(registry, ["@file"])).toEqual(["file_read_file", "file_write_file"]);
  });
});

describe("listToolsCatalog", () => {
  it("pagination and toolset filter", () => {
    const registry = testRegistry();
    const all = listToolsCatalog(registry);
    expect(all.total).toBe(3);
    const fileOnly = listToolsCatalog(registry, { toolset: "file" });
    expect(fileOnly.total).toBe(2);
    expect(fileOnly.tools.map((t) => t.name)).toEqual(["file_read_file", "file_write_file"]);
  });
});

describe("searchToolsetsCatalog", () => {
  it("matches toolsets by AND tokens", () => {
    const registry = testRegistry();
    const hit = searchToolsetsCatalog(registry, "read file");
    expect(hit.hits.some((h) => h.toolset === "file")).toBe(true);
  });
});

describe("searchToolsCatalog", () => {
  it("matches by name or description", () => {
    const registry = testRegistry();
    const hit = searchToolsCatalog(registry, "read");
    expect(hit.tools.some((t) => t.name === "file_read_file")).toBe(true);
  });
});

describe("formatToolsForToolMessage", () => {
  it("returns full parameters", () => {
    const registry = testRegistry();
    const formatted = formatToolsForToolMessage(registry, ["file_read_file"]);
    expect(formatted).toHaveLength(1);
    expect(formatted[0]?.parameters).toEqual({
      type: "object",
      properties: { path: { type: "string" } },
    });
  });
});
