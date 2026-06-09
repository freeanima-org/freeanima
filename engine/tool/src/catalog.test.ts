import { describe, expect, it } from "bun:test";
import {
  expandToolNames,
  formatToolsForToolMessage,
  listToolsCatalog,
  searchToolsCatalog,
} from "./catalog.ts";
import { ToolSetRegistry } from "./toolset.ts";

function testRegistry(): ToolSetRegistry {
  const registry = new ToolSetRegistry();
  registry.registerToolSet("fs", "文件", [
    {
      name: "read_file",
      description: "读取文件",
      parameters: { type: "object", properties: { path: { type: "string" } } },
      handler: () => "ok",
    },
    {
      name: "write_file",
      description: "写入文件",
      parameters: { type: "object", properties: {} },
      handler: () => "ok",
    },
  ]);
  registry.registerToolSet("catalog", "目录", [
    {
      name: "tool_search",
      description: "搜索工具",
      parameters: { type: "object", properties: {} },
      handler: () => "ok",
    },
  ]);
  return registry;
}

describe("expandToolNames", () => {
  it("展开 @toolset", () => {
    const registry = testRegistry();
    expect(expandToolNames(registry, ["@fs"])).toEqual(["read_file", "write_file"]);
  });
});

describe("listToolsCatalog", () => {
  it("分页与 toolset 过滤", () => {
    const registry = testRegistry();
    const all = listToolsCatalog(registry);
    expect(all.total).toBe(3);
    const fsOnly = listToolsCatalog(registry, { toolset: "fs" });
    expect(fsOnly.total).toBe(2);
    expect(fsOnly.tools.map((t) => t.name)).toEqual(["read_file", "write_file"]);
  });
});

describe("searchToolsCatalog", () => {
  it("按名称或描述匹配", () => {
    const registry = testRegistry();
    const hit = searchToolsCatalog(registry, "读取");
    expect(hit.tools.some((t) => t.name === "read_file")).toBe(true);
  });
});

describe("formatToolsForToolMessage", () => {
  it("返回完整 parameters", () => {
    const registry = testRegistry();
    const formatted = formatToolsForToolMessage(registry, ["read_file"]);
    expect(formatted).toHaveLength(1);
    expect(formatted[0]?.parameters).toEqual({
      type: "object",
      properties: { path: { type: "string" } },
    });
  });
});
