import { describe, expect, it, mock, beforeEach } from "bun:test";
import { ToolSetRegistry } from "@freeanima/host/core/tool";
import { registerToolsetTools } from "./toolset.ts";
import { runWithToolContext } from "@freeanima/host/core/tool";

const sessionMeta = {
  role: "conversation_meta" as const,
  model: "test",
  cached_toolsets: ["toolset"],
  staged_toolsets: [] as string[],
  functions: [] as string[],
  timestamp: "2026-01-01T00:00:00+08:00",
};

const getConversationMetaMock = mock(async () => sessionMeta);
const patchConversationMetaMock = mock(async () => {});

mock.module("@freeanima/host/core/db/pg/conversation", () => ({
  getConversationMeta: getConversationMetaMock,
  patchConversationMeta: patchConversationMetaMock,
}));

describe("registerToolsetTools", () => {
  beforeEach(() => {
    getConversationMetaMock.mockClear();
    patchConversationMetaMock.mockClear();
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
