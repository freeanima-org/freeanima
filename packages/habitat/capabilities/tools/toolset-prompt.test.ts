import { describe, expect, it } from "bun:test";
import { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import {
  formatToolNamesForCatalog,
  renderToolsetsBody,
  renderToolsetsSection,
} from "./toolset-prompt.ts";

describe("formatToolNamesForCatalog", () => {
  it("collapses first-segment prefixes with 2+ tools", () => {
    expect(
      formatToolNamesForCatalog([
        "task_create",
        "task_get",
        "task_list",
        "tasklist_list",
        "tasklist_create",
      ]),
    ).toBe("task_*, tasklist_*");
  });
});

describe("renderToolsetsSection", () => {
  it("lists catalog toolsets with tool names and points to toolset_search", () => {
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
    expect(section).toContain("Built-in ToolSets");
    expect(section).toContain("- file — Read and write workspace files · file_read");
    expect(section).toContain("- memory — Semantic memory tools · memory_semantic_search");
    expect(section).not.toContain("- ops —");
    expect(section).not.toContain("- secret —");
    expect(section.indexOf("- file")).toBeLessThan(section.indexOf("- memory"));
  });

  it("omits toolsets whose tools are all filtered", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("file", "Read and write workspace files", [
      {
        name: "file_read",
        description: "Read",
        parameters: { type: "object", properties: {} },
        handler: () => "ok",
      },
    ]);
    registry.registerToolSet("memory", "Semantic memory tools", [
      {
        name: "memory_semantic_search",
        description: "Recall",
        parameters: { type: "object", properties: {} },
        handler: () => "ok",
      },
    ]);
    const body = renderToolsetsBody(registry, {
      allowedToolNames: ["memory_semantic_search"],
      extraIntro: "不要 toolset_load 栖息地本机 file / shell。",
    });
    expect(body).toContain("不要 toolset_load");
    expect(body).toContain("- memory —");
    expect(body).not.toContain("- file —");
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
