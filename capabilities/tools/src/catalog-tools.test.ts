import { describe, expect, it, mock, beforeEach } from "bun:test";
import { ToolSetRegistry } from "@freeanima/engine-tool";
import { registerCatalogTools } from "./catalog-tools.ts";
import { runWithToolContext } from "@freeanima/engine-loop";

const loadSessionMeta = mock(async () => ({
  role: "session_meta" as const,
  model: "test",
  tools: ["tools_list", "tools_load"],
  loaded_tools: [] as string[],
  functions: [] as string[],
  timestamp: "2026-01-01T00:00:00+08:00",
}));

const loadToolsIntoSession = mock(async () => ({
  loaded: ["file_read_file"],
  denied: [] as string[],
  already_loaded: [] as string[],
  unknown: [] as string[],
  tools: [
    {
      name: "file_read_file",
      description: "读文件",
      toolset: "file",
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

  it("tools_load 返回 schema 并调用 loadToolsIntoSession", async () => {
    const toolSets = new ToolSetRegistry();
    registerCatalogTools(toolSets);
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
        expect(loadToolsIntoSession).toHaveBeenCalled();
      },
      {
        tools: toolSets,
        repos: {} as never,
        executableTools: ["tools_load"],
      },
    );
  });

  it("tools_list 无 query 时分页列出", async () => {
    const toolSets = new ToolSetRegistry();
    registerCatalogTools(toolSets);
    toolSets.registerToolSet("file", "文件", [
      {
        name: "file_read_file",
        description: "读",
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
      { tools: toolSets, repos: {} as never, executableTools: ["tools_list"] },
    );
  });

  it("tools_list 有 query 时搜索过滤", async () => {
    const toolSets = new ToolSetRegistry();
    registerCatalogTools(toolSets);
    toolSets.registerToolSet("file", "文件", [
      {
        name: "file_read_file",
        description: "读取文本",
        parameters: { type: "object", properties: {} },
        handler: () => "ok",
      },
    ]);
    const listDef = toolSets.getTool("tools_list")!;

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await listDef.handler({ query: "读取" });
        const parsed = JSON.parse(raw);
        expect(parsed.query).toBe("读取");
        expect(parsed.tools.some((t: { name: string }) => t.name === "file_read_file")).toBe(true);
      },
      { tools: toolSets, repos: {} as never, executableTools: ["tools_list"] },
    );
  });
});
