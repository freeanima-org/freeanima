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
import { DEFAULT_SESSION_TOOLSETS } from "@freeanima/core/tool";
import { runWithToolContext } from "@freeanima/runtime/loop";
import * as engine from "@freeanima/runtime/loop";
import * as llm from "@freeanima/core/llm";
import { resolveExecutableToolNames } from "@freeanima/runtime/conversation";
import { TEST_SAP_PARLOR_PLATFORM } from "../../helpers/sap-parlor-test-platform.ts";

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

  it("new session system_prompt lists ToolSets compactly", async () => {
    const c = testConv();
    const sid = await c.newSession(TEST_SAP_PARLOR_PLATFORM);
    const meta = await c.loadSessionMeta(sid);
    expect(isSessionMeta(meta)).toBe(true);
    if (!isSessionMeta(meta)) return;
    const sp = meta.system_prompt ?? "";
    expect(sp).toContain("## ToolSets");
    expect(sp).toContain("- file —");
    expect(sp).toContain("toolset_load");
  });

  it("new session meta stores default cached toolsets", async () => {
    const c = testConv();
    const sid = await c.newSession(TEST_SAP_PARLOR_PLATFORM);
    const meta = await c.loadSessionMeta(sid);
    expect(isSessionMeta(meta)).toBe(true);
    if (!isSessionMeta(meta)) return;

    for (const expected of DEFAULT_SESSION_TOOLSETS) {
      if (getTestEngine().toolSets.getToolSet(expected)) {
        expect(meta.cached_toolsets).toContain(expected);
      }
    }
    expect(meta.staged_toolsets ?? []).toEqual([]);

    const schemas = await c.loadSessionTools(sid, meta);
    const names = schemas.map((t) => t.function.name);
    expect(names).toContain("toolset_search");
    expect(names).not.toContain("file_read");
  });

  it("toolset_load writes staged_toolsets without extending API schema", async () => {
    const c = testConv();
    const sid = await c.newSession(TEST_SAP_PARLOR_PLATFORM);
    const toolLoad = getTestEngine().toolSets.getTool("toolset_load");
    expect(toolLoad).toBeDefined();

    await runWithToolContext(
      sid,
      async () => {
        const raw = await toolLoad!.handler({ toolsets: ["file"] });
        const parsed = JSON.parse(raw);
        expect(parsed.tools?.[0]?.name).toBe("file_read");
        expect(parsed.tools?.[0]?.parameters).toBeDefined();
      },
      { repos: c.repos, tools: getTestEngine().toolSets },
    );

    const meta = await c.loadSessionMeta(sid);
    expect(isSessionMeta(meta)).toBe(true);
    if (!isSessionMeta(meta)) return;
    expect(meta.staged_toolsets).toContain("file");

    const schemas = await c.loadSessionTools(sid, meta);
    expect(schemas.map((t) => t.function.name)).not.toContain("file_read");
  });

  it("unloaded tools are blocked by executableTools gate", async () => {
    const c = testConv();
    const sid = await c.newSession(TEST_SAP_PARLOR_PLATFORM);
    const meta = await c.loadSessionMeta(sid);
    expect(isSessionMeta(meta)).toBe(true);
    if (!isSessionMeta(meta)) return;

    const tools = await c.loadSessionTools(sid, meta);
    const executableTools = resolveExecutableToolNames(meta, getTestEngine().toolSets);

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
    expect(toolMsg?.content).toContain("toolset_load");
  });

  it("toolset_search requires query and returns hits", async () => {
    const c = testConv();
    const sid = await c.newSession(TEST_SAP_PARLOR_PLATFORM);
    const searchDef = getTestEngine().toolSets.getTool("toolset_search");
    expect(searchDef).toBeDefined();

    await runWithToolContext(
      sid,
      async () => {
        const raw = await searchDef!.handler({ query: "read file" });
        const parsed = JSON.parse(raw);
        expect(parsed.query).toBe("read file");
        expect(parsed.total).toBeGreaterThan(0);
        expect(parsed.hits.some((h: { toolset: string }) => h.toolset === "file")).toBe(true);
      },
      { repos: c.repos, tools: getTestEngine().toolSets, executableTools: ["toolset_search"] },
    );
  });
});
