import { describe, expect, it } from "bun:test";
import { ToolSetRegistry } from "@freeanima/core/tool";
import { renderToolsetsSection } from "./toolset-prompt.ts";

describe("renderToolsetsSection", () => {
  it("lists toolset names and descriptions sorted by name", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("memory", "Semantic memory tools", [
      {
        name: "memory_recall",
        description: "Recall",
        parameters: { type: "object", properties: {} },
        handler: () => "ok",
      },
    ]);
    registry.registerToolSet("file", "Read and write workspace files", [
      {
        name: "file_read",
        description: "Read",
        parameters: { type: "object", properties: {} },
        handler: () => "ok",
      },
    ]);
    const section = renderToolsetsSection(registry);
    expect(section).toContain("## ToolSets");
    expect(section).toContain("toolset_load");
    expect(section).toContain("- file — Read and write workspace files");
    expect(section).toContain("- memory — Semantic memory tools");
    expect(section.indexOf("- file")).toBeLessThan(section.indexOf("- memory"));
  });

  it("returns empty when no toolsets", () => {
    const registry = new ToolSetRegistry();
    expect(renderToolsetsSection(registry)).toBe("");
  });
});
