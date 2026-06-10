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
  registry.registerToolSet("file", "文件", [
    {
      name: "file_read_file",
      description: "读取文件",
      parameters: { type: "object", properties: { path: { type: "string" } } },
      handler: () => "ok",
    },
    {
      name: "file_write_file",
      description: "写入文件",
      parameters: { type: "object", properties: {} },
      handler: () => "ok",
    },
  ]);
  registry.registerToolSet("tools", "目录", [
    {
      name: "tools_list",
      description: "列出工具",
      parameters: { type: "object", properties: {} },
      handler: () => "ok",
    },
  ]);
  return registry;
}

describe("expandToolNames", () => {
  it("展开 @toolset", () => {
    const registry = testRegistry();
    expect(expandToolNames(registry, ["@file"])).toEqual(["file_read_file", "file_write_file"]);
  });
});

describe("listToolsCatalog", () => {
  it("分页与 toolset 过滤", () => {
    const registry = testRegistry();
    const all = listToolsCatalog(registry);
    expect(all.total).toBe(3);
    const fileOnly = listToolsCatalog(registry, { toolset: "file" });
    expect(fileOnly.total).toBe(2);
    expect(fileOnly.tools.map((t) => t.name)).toEqual(["file_read_file", "file_write_file"]);
  });
});

describe("searchToolsCatalog", () => {
  it("按名称或描述匹配", () => {
    const registry = testRegistry();
    const hit = searchToolsCatalog(registry, "读取");
    expect(hit.tools.some((t) => t.name === "file_read_file")).toBe(true);
  });
});

describe("formatToolsForToolMessage", () => {
  it("返回完整 parameters", () => {
    const registry = testRegistry();
    const formatted = formatToolsForToolMessage(registry, ["file_read_file"]);
    expect(formatted).toHaveLength(1);
    expect(formatted[0]?.parameters).toEqual({
      type: "object",
      properties: { path: { type: "string" } },
    });
  });
});
