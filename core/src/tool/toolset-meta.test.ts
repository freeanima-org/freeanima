import { describe, expect, it } from "bun:test";

import { ToolSetRegistry } from "./toolset.ts";
import {
  loadCallFullyCached,
  mergeToolSetNames,
  parseToolSetsFromLoadArgs,
  resolveToolSetNames,
  toolNamesForToolSets,
  toolSetForTool,
} from "./toolset-meta.ts";

const sampleTool = (name: string) => ({
  name,
  description: name,
  parameters: { type: "object", properties: {} },
  handler: () => '{"ok":true}',
});

describe("toolset-meta", () => {
  const registry = new ToolSetRegistry();
  registry.registerToolSet("browser", "Browser", [
    sampleTool("browser_navigate"),
    sampleTool("browser_click"),
  ]);
  registry.registerToolSet("local", "Local", [sampleTool("read_file")]);

  it("toolSetForTool resolves owning set", () => {
    expect(toolSetForTool(registry, "browser_click")).toBe("browser");
    expect(toolSetForTool(registry, "missing")).toBeNull();
    expect(toolSetForTool(registry, "  ")).toBeNull();
  });

  it("mergeToolSetNames dedupes preserving order", () => {
    expect(mergeToolSetNames(["a", "b"], ["b", "c", ""])).toEqual(["a", "b", "c"]);
  });

  it("resolveToolSetNames maps tool names and set names", () => {
    expect(resolveToolSetNames(registry, ["browser_navigate", "local", "local"])).toEqual([
      "browser",
      "local",
    ]);
  });

  it("toolNamesForToolSets expands unique tool names", () => {
    expect(toolNamesForToolSets(registry, ["browser", "local"])).toEqual([
      "browser_navigate",
      "browser_click",
      "read_file",
    ]);
  });

  it("parseToolSetsFromLoadArgs reads toolsets or names", () => {
    expect(parseToolSetsFromLoadArgs({ toolsets: ["a", " b "] })).toEqual(["a", "b"]);
    expect(parseToolSetsFromLoadArgs({ names: ["x"] })).toEqual(["x"]);
    expect(parseToolSetsFromLoadArgs(null)).toEqual([]);
    expect(parseToolSetsFromLoadArgs({ toolsets: "nope" })).toEqual([]);
  });

  it("loadCallFullyCached checks subset", () => {
    expect(loadCallFullyCached(["a", "b"], ["a", "b", "c"])).toBe(true);
    expect(loadCallFullyCached(["a"], ["b"])).toBe(false);
    expect(loadCallFullyCached([], ["a"])).toBe(false);
  });
});
