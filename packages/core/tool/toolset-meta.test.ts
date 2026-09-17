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

  it("resolveToolSetNames maps legacy split names onto consolidated sets", () => {
    const consolidated = new ToolSetRegistry();
    consolidated.registerToolSet("agenda", "Agenda", [
      sampleTool("task_create"),
      sampleTool("tasklist_list"),
      sampleTool("project_list"),
      sampleTool("calendar_list"),
    ]);
    consolidated.registerToolSet("email", "Email", [
      sampleTool("email_sync"),
      sampleTool("email_list_accounts"),
    ]);
    consolidated.registerToolSet("content", "Content", [
      sampleTool("note_create"),
      sampleTool("diary_get"),
      sampleTool("content_block_list"),
    ]);
    consolidated.registerToolSet("memory", "Memory", [
      sampleTool("memory_remember"),
      sampleTool("memory_semantic_search"),
    ]);
    consolidated.registerToolSet("shell", "Shell", [
      sampleTool("terminal_run"),
      sampleTool("code_execute"),
    ]);
    consolidated.registerToolSet("entity", "Entity", [
      sampleTool("entity_get"),
      sampleTool("tag_list"),
    ]);

    expect(resolveToolSetNames(consolidated, ["task", "tasklist", "project", "calendar"])).toEqual([
      "agenda",
    ]);
    expect(resolveToolSetNames(consolidated, ["email-account"])).toEqual(["email"]);
    expect(resolveToolSetNames(consolidated, ["note", "diary", "content-block"])).toEqual([
      "content",
    ]);
    expect(resolveToolSetNames(consolidated, ["memory_semantic"])).toEqual(["memory"]);
    expect(resolveToolSetNames(consolidated, ["code", "terminal"])).toEqual(["shell"]);
    expect(resolveToolSetNames(consolidated, ["tag"])).toEqual(["entity"]);
    expect(
      toolNamesForToolSets(consolidated, resolveToolSetNames(consolidated, ["tasklist"])),
    ).toEqual(["task_create", "tasklist_list", "project_list", "calendar_list"]);
  });
});
