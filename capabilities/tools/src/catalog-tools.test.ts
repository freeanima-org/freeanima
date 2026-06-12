import { describe, expect, it, mock, beforeEach } from "bun:test";
import { ToolSetRegistry } from "@freeanima/mechanism-tool";
import { registerCatalogTools } from "./catalog-tools.ts";
import { runWithToolContext } from "@freeanima/mechanism-tool";

const sessionMeta = {
  role: "session_meta" as const,
  model: "test",
  tools: ["tools_list", "tools_load"],
  loaded_tools: [] as string[],
  functions: [] as string[],
  timestamp: "2026-01-01T00:00:00+08:00",
};

const getSessionMeta = mock(async () => sessionMeta);

const repos = {
  pgAvailable: false,
  session: { getSessionMeta },
} as never;

describe("registerCatalogTools", () => {
  beforeEach(() => {
    getSessionMeta.mockClear();
  });

  it("tools_load returns schema and calls loadToolsIntoSession", async () => {
    const toolSets = new ToolSetRegistry();
    registerCatalogTools(toolSets);
    toolSets.registerToolSet("file", "Files", [
      {
        name: "file_read_file",
        description: "Read file",
        parameters: { type: "object", properties: {} },
        handler: () => "ok",
      },
    ]);
    const def = toolSets.getTool("tools_load");
    expect(def).toBeDefined();

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await def!.handler({ names: ["file_read_file"] });
        const parsed = JSON.parse(raw);
        expect(parsed.tools).toHaveLength(1);
        expect(parsed.tools[0].name).toBe("file_read_file");
        expect(parsed.tools[0].parameters).toBeDefined();
        expect(getSessionMeta).toHaveBeenCalled();
      },
      {
        tools: toolSets,
        repos,
        executableTools: ["tools_load"],
      },
    );
  });

  it("tools_list returns all tools when no filters", async () => {
    const toolSets = new ToolSetRegistry();
    registerCatalogTools(toolSets);
    toolSets.registerToolSet("file", "Files", [
      {
        name: "file_read_file",
        description: "Read",
        parameters: { type: "object", properties: {} },
        handler: () => "ok",
      },
    ]);
    const listDef = toolSets.getTool("tools_list");
    expect(listDef).toBeDefined();

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await listDef!.handler({});
        const parsed = JSON.parse(raw);
        expect(parsed.total).toBeGreaterThanOrEqual(2);
        expect(parsed.tools.some((t: { name: string }) => t.name === "file_read_file")).toBe(true);
      },
      { tools: toolSets, repos, executableTools: ["tools_list"] },
    );
  });

  it("tools_list filters by keyword and toolset", async () => {
    const toolSets = new ToolSetRegistry();
    registerCatalogTools(toolSets);
    toolSets.registerToolSet("file", "Files", [
      {
        name: "file_read_file",
        description: "Read text",
        parameters: { type: "object", properties: {} },
        handler: () => "ok",
      },
    ]);
    toolSets.registerToolSet("web", "Web", [
      {
        name: "web_search",
        description: "Search web",
        parameters: { type: "object", properties: {} },
        handler: () => "ok",
      },
    ]);
    const listDef = toolSets.getTool("tools_list")!;

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await listDef.handler({ keyword: "read", toolset: "file" });
        const parsed = JSON.parse(raw);
        expect(parsed.keyword).toBe("read");
        expect(parsed.tools.every((t: { toolset: string }) => t.toolset === "file")).toBe(true);
        expect(parsed.tools.some((t: { name: string }) => t.name === "file_read_file")).toBe(true);
        expect(parsed.tools.some((t: { name: string }) => t.name === "web_search")).toBe(false);
      },
      { tools: toolSets, repos, executableTools: ["tools_list"] },
    );
  });
});
