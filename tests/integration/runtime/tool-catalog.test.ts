import { expect, it, beforeEach, afterEach, afterAll, spyOn } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import type { SessionMessage } from "@freeanima/core/db/domain";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { getActivePgTestContext, getTestEngine, testConv } from "../../helpers/pg-test.ts";
import { registerServiceTools } from "@freeanima/platform";
import { isSessionMeta } from "@freeanima/core/db/domain";
import { DEFAULT_SESSION_TOOL_NAMES } from "@freeanima/core/tool";
import { runWithToolContext } from "@freeanima/runtime/loop";
import * as engine from "@freeanima/runtime/loop";
import * as llm from "@freeanima/core/llm";

describePg("tool catalog lazy load", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("anima-tool-catalog-");
    const eng = getTestEngine();
    registerServiceTools({
      toolSets: eng.toolSets,
      skills: eng.skills,
      config: getActivePgTestContext()!.config,
    });
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("new session system_prompt lists ToolSets", async () => {
    const c = testConv();
    const sid = await c.newSession("parlor");
    const meta = await c.loadSessionMeta(sid);
    expect(isSessionMeta(meta)).toBe(true);
    if (!isSessionMeta(meta)) return;
    const sp = meta.system_prompt ?? "";
    expect(sp).toContain("## ToolSets");
    expect(sp).toContain("### file");
    expect(sp).toContain("tools_list");
  });

  it("new session schema includes default tools only", async () => {
    const c = testConv();
    const sid = await c.newSession("parlor");
    const meta = await c.loadSessionMeta(sid);
    expect(isSessionMeta(meta)).toBe(true);
    if (!isSessionMeta(meta)) return;

    const schemas = await c.loadSessionTools(sid, meta);
    const names = schemas.map((t) => t.function.name);
    for (const expected of DEFAULT_SESSION_TOOL_NAMES) {
      if (getTestEngine().toolSets.getTool(expected)) {
        expect(names).toContain(expected);
        expect(meta.tools).toContain(expected);
      }
    }
    expect(names).not.toContain("file_read_file");
    expect(meta.loaded_tools ?? []).toEqual([]);
  });

  it("tools_load writes loaded_tools without extending schema", async () => {
    const c = testConv();
    const sid = await c.newSession("parlor");
    const toolLoad = getTestEngine().toolSets.getTool("tools_load");
    expect(toolLoad).toBeDefined();

    await runWithToolContext(
      sid,
      async () => {
        const raw = await toolLoad!.handler({ names: ["file_read_file"] });
        const parsed = JSON.parse(raw);
        expect(parsed.tools?.[0]?.name).toBe("file_read_file");
        expect(parsed.tools?.[0]?.parameters).toBeDefined();
      },
      { repos: c.repos, tools: getTestEngine().toolSets },
    );

    const meta = await c.loadSessionMeta(sid);
    expect(isSessionMeta(meta)).toBe(true);
    if (!isSessionMeta(meta)) return;
    expect(meta.loaded_tools).toContain("file_read_file");

    const schemas = await c.loadSessionTools(sid, meta);
    expect(schemas.map((t) => t.function.name)).not.toContain("file_read_file");
  });

  it("unloaded tools are blocked by executableTools gate", async () => {
    const c = testConv();
    const sid = await c.newSession("parlor");
    const meta = await c.loadSessionMeta(sid);
    expect(isSessionMeta(meta)).toBe(true);
    if (!isSessionMeta(meta)) return;

    const tools = await c.loadSessionTools(sid, meta);
    const executableTools = [...meta.tools, ...(meta.loaded_tools ?? [])];

    getTestEngine().toolSets.registerToolSet("__gate_test__", "test", [
      {
        name: "gate_test_tool",
        description: "test",
        parameters: { type: "object", properties: {} },
        handler: async () => '{"ok":true}',
      },
    ]);

    let llmTurn = 0;
    const chatStreamSpy = spyOn(llm, "chatStream").mockImplementation(async function* () {
      if (llmTurn++ === 0) {
        yield {
          type: "tool_calls",
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "gate_test_tool", arguments: "{}" },
            },
          ],
        };
        yield { type: "done", finish_reason: "tool_calls", usage: null, reasoning: null };
        return;
      }
      yield { type: "done", finish_reason: "stop", usage: null, reasoning: null };
    });

    const msgs: SessionMessage[] = [
      {
        role: "user",
        content: "test",
      },
    ];

    try {
      await runWithToolContext(
        sid,
        async () => {
          await engine.run(msgs, { tools, executableTools });
        },
        { repos: c.repos, tools: getTestEngine().toolSets, executableTools },
      );
    } finally {
      chatStreamSpy.mockRestore();
    }

    const toolMsg = msgs.find((m) => m.role === "tool");
    expect(toolMsg?.content).toContain("tools_load");
  });

  it("tools_list supports keyword and toolset filters", async () => {
    const c = testConv();
    const sid = await c.newSession("parlor");
    const listDef = getTestEngine().toolSets.getTool("tools_list");
    expect(listDef).toBeDefined();

    await runWithToolContext(
      sid,
      async () => {
        const raw = await listDef!.handler({ keyword: "read", toolset: "file" });
        const parsed = JSON.parse(raw);
        expect(parsed.keyword).toBe("read");
        expect(parsed.tools.every((t: { toolset: string }) => t.toolset === "file")).toBe(true);
        expect(parsed.tools.some((t: { name: string }) => t.name === "file_read_file")).toBe(true);
      },
      { repos: c.repos, tools: getTestEngine().toolSets, executableTools: ["tools_list"] },
    );
  });
});
