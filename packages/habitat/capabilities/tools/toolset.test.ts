import { describe, expect, it, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { isExecutableTool, runWithToolContext } from "@freeanima/habitat/core/tool";
import * as pg from "@freeanima/habitat/core/db/pg";
import { registerToolsetTools } from "./toolset.ts";

const sessionMeta = {
  model: "test",
  cached_toolsets: ["toolset"] as string[],
  staged_toolsets: [] as string[],
  functions: [] as string[],
  timestamp: "2026-01-01T00:00:00+08:00",
};

const getConversationMetaMock = mock(async () => sessionMeta);
const patchConversationMetaMock = mock(async () => {});

mock.module("@freeanima/habitat/core/db/pg/conversation", () => ({
  getConversationMeta: getConversationMetaMock,
  patchConversationMeta: patchConversationMetaMock,
}));

describe("registerToolsetTools", () => {
  let pgSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    pgSpy = spyOn(pg, "isPostgresPrimary").mockReturnValue(true);
    getConversationMetaMock.mockClear();
    patchConversationMetaMock.mockClear();
    sessionMeta.cached_toolsets = ["toolset"];
    sessionMeta.staged_toolsets = [];
  });

  afterEach(() => {
    pgSpy.mockRestore();
  });

  it("toolset_load returns schema for staged toolset", async () => {
    const toolSets = new ToolSetRegistry();
    registerToolsetTools(toolSets);
    toolSets.registerToolSet("file", "Files", [
      {
        name: "file_read",
        description: "Read file",
        parameters: { type: "object", properties: {} },
        handler: () => "ok",
      },
    ]);
    const def = toolSets.getTool("toolset_load");
    expect(def).toBeDefined();

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await def!.handler({ toolsets: ["file"] });
        const parsed = JSON.parse(raw);
        expect(parsed.tools).toHaveLength(1);
        expect(parsed.tools[0].name).toBe("file_read");
        expect(parsed.loaded).toEqual(["file"]);
      },
      {
        tools: toolSets,
        executableTools: ["toolset_load"],
      },
    );
  });

  it("toolset_unload revokes executable tools and patches meta", async () => {
    sessionMeta.cached_toolsets = ["toolset", "file"];
    const toolSets = new ToolSetRegistry();
    registerToolsetTools(toolSets);
    toolSets.registerToolSet("file", "Files", [
      {
        name: "file_read",
        description: "Read file",
        parameters: { type: "object", properties: {} },
        handler: () => "ok",
      },
    ]);
    const def = toolSets.getTool("toolset_unload");
    expect(def).toBeDefined();

    await runWithToolContext(
      "sess-1",
      async () => {
        expect(isExecutableTool("file_read")).toBe(true);
        const raw = await def!.handler({ toolsets: ["file"] });
        const parsed = JSON.parse(raw);
        expect(parsed.unloaded).toEqual(["file"]);
        expect(parsed.protected).toEqual([]);
        expect(isExecutableTool("file_read")).toBe(false);
        expect(isExecutableTool("toolset_unload")).toBe(true);
      },
      {
        tools: toolSets,
        executableTools: ["toolset_unload", "file_read"],
      },
    );

    expect(patchConversationMetaMock).toHaveBeenCalledWith("sess-1", {
      cached_toolsets: ["toolset"],
      staged_toolsets: [],
    });
  });

  it("toolset_unload protects default ToolSets", async () => {
    sessionMeta.cached_toolsets = ["toolset", "memory"];
    const toolSets = new ToolSetRegistry();
    registerToolsetTools(toolSets);
    toolSets.registerToolSet("memory", "Memory", [
      {
        name: "memory_semantic_search",
        description: "search",
        parameters: { type: "object", properties: {} },
        handler: () => "ok",
      },
    ]);
    const def = toolSets.getTool("toolset_unload");
    expect(def).toBeDefined();

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await def!.handler({ toolsets: ["memory"] });
        const parsed = JSON.parse(raw);
        expect(parsed.unloaded).toEqual([]);
        expect(parsed.protected).toEqual(["memory"]);
      },
      {
        tools: toolSets,
        executableTools: ["toolset_unload", "memory_semantic_search"],
      },
    );

    expect(patchConversationMetaMock).not.toHaveBeenCalled();
  });

  it("toolset_search requires query", async () => {
    const toolSets = new ToolSetRegistry();
    registerToolsetTools(toolSets);
    toolSets.registerToolSet("file", "Files", [
      {
        name: "file_read",
        description: "Read text files",
        parameters: { type: "object", properties: {} },
        handler: () => "ok",
      },
    ]);
    const searchDef = toolSets.getTool("toolset_search");
    expect(searchDef).toBeDefined();

    await runWithToolContext(
      "sess-1",
      async () => {
        const errRaw = await searchDef!.handler({});
        expect(JSON.parse(errRaw).error).toBeTruthy();
      },
      { tools: toolSets, executableTools: ["toolset_search"] },
    );
  });
});
