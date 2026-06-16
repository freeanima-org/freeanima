import { describe, expect, it, mock, beforeEach } from "bun:test";
import { ToolSetRegistry } from "@freeanima/core/tool";
import { registerToolsetTools } from "./toolset.ts";
import { runWithToolContext } from "@freeanima/core/tool";

const sessionMeta = {
  role: "session_meta" as const,
  model: "test",
  cached_toolsets: ["toolset"],
  staged_toolsets: [] as string[],
  functions: [] as string[],
  timestamp: "2026-01-01T00:00:00+08:00",
};

const getSessionMeta = mock(async () => sessionMeta);

const patchSessionMeta = mock(async () => {});

const repos = {
  pgAvailable: true,
  session: { getSessionMeta, patchSessionMeta },
} as never;

describe("registerToolsetTools", () => {
  beforeEach(() => {
    getSessionMeta.mockClear();
    patchSessionMeta.mockClear();
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
        expect(patchSessionMeta).toHaveBeenCalled();
      },
      {
        tools: toolSets,
        repos,
        executableTools: ["toolset_load"],
      },
    );
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

        const raw = await searchDef!.handler({ query: "read file" });
        const parsed = JSON.parse(raw);
        expect(parsed.query).toBe("read file");
        expect(parsed.hits.some((h: { toolset: string }) => h.toolset === "file")).toBe(true);
      },
      { tools: toolSets, repos, executableTools: ["toolset_search"] },
    );
  });
});
