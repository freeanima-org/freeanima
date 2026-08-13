import { describe, expect, it } from "bun:test";
import { ToolSetRegistry } from "@freeanima/host/core/tool";
import { renderToolsetsSection } from "./toolset-prompt.ts";

describe("renderToolsetsSection", () => {
  it("lists catalog toolsets sorted by name and points to toolset_search", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("memory", "Semantic memory tools", [
      {
        name: "memory_semantic_search",
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
    registry.registerToolSet(
      "ops",
      "Habitat ops",
      [
        {
          name: "ops_status",
          description: "Status",
          parameters: { type: "object", properties: {} },
          handler: () => "ok",
        },
      ],
      { visibility: "searchable" },
    );
    registry.registerToolSet(
      "secret",
      "Hidden",
      [
        {
          name: "secret_tool",
          description: "Secret",
          parameters: { type: "object", properties: {} },
          handler: () => "ok",
        },
      ],
      { visibility: "hidden" },
    );
    const section = renderToolsetsSection(registry);
    expect(section).toContain("<toolsets>");
    expect(section).toContain("</toolsets>");
    expect(section).toContain("toolset_search");
    expect(section).toContain("toolset_load");
    expect(section).toContain("not the full inventory");
    expect(section).toContain("- file — Read and write workspace files");
    expect(section).toContain("- memory — Semantic memory tools");
    expect(section).not.toContain("- ops —");
    expect(section).not.toContain("- secret —");
    expect(section.indexOf("- file")).toBeLessThan(section.indexOf("- memory"));
  });

  it("returns empty when no catalog toolsets", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet(
      "ops",
      "ops",
      [
        {
          name: "ops_status",
          description: "s",
          parameters: { type: "object", properties: {} },
          handler: () => "ok",
        },
      ],
      { visibility: "searchable" },
    );
    expect(renderToolsetsSection(registry)).toBe("");
  });

  it("returns empty when no toolsets", () => {
    const registry = new ToolSetRegistry();
    expect(renderToolsetsSection(registry)).toBe("");
  });
});
