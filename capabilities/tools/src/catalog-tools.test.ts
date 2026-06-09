import { describe, expect, it, mock, beforeEach } from "bun:test";
import { ToolSetRegistry } from "@freeanima/engine-tool";
import { registerCatalogTools } from "./catalog-tools.ts";
import { runWithToolContext } from "@freeanima/engine-loop";

const loadSessionMeta = mock(async () => ({
  role: "session_meta" as const,
  model: "test",
  tools: ["tool_search", "tool_load"],
  loaded_tools: [] as string[],
  functions: [] as string[],
  timestamp: "2026-01-01T00:00:00+08:00",
}));

const loadToolsIntoSession = mock(async () => ({
  loaded: ["read_file"],
  denied: [] as string[],
  already_loaded: [] as string[],
  unknown: [] as string[],
  tools: [
    {
      name: "read_file",
      description: "读文件",
      toolset: "fs",
      parameters: { type: "object", properties: {} },
    },
  ],
}));

mock.module("@freeanima/engine-conversation", () => ({
  isSessionMeta: (meta: { role?: string }) => meta.role === "session_meta",
  loadSessionMeta,
  loadToolsIntoSession,
  applySessionToolMaskFilter: (names: string[]) => names,
}));

describe("registerCatalogTools", () => {
  beforeEach(() => {
    loadSessionMeta.mockClear();
    loadToolsIntoSession.mockClear();
  });

  it("tool_load 返回 schema 并调用 loadToolsIntoSession", async () => {
    const toolSets = new ToolSetRegistry();
    registerCatalogTools(toolSets);
    const def = toolSets.getTool("tool_load");
    expect(def).toBeDefined();

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await def!.handler({ names: ["read_file"] });
        const parsed = JSON.parse(raw);
        expect(parsed.tools).toHaveLength(1);
        expect(parsed.tools[0].name).toBe("read_file");
        expect(parsed.tools[0].parameters).toBeDefined();
        expect(loadToolsIntoSession).toHaveBeenCalled();
      },
      {
        tools: toolSets,
        repos: {} as never,
        executableTools: ["tool_load"],
      },
    );
  });
});
