import { expect, it, beforeEach, afterEach, afterAll, spyOn } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import type { StoredMessage } from "@freeanima/core/db/domain";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { getActivePgTestContext, getTestEngine, testConv } from "../../helpers/pg-test.ts";
import { registerServiceTools } from "@freeanima/platform";
import { isConversationMeta } from "@freeanima/core/db/domain";
import { DEFAULT_CONVERSATION_TOOLSETS } from "@freeanima/core/tool";
import { runWithToolContext } from "@freeanima/runtime/loop";
import * as engine from "@freeanima/runtime/loop";
import * as llm from "@freeanima/core/llm";
import { resolveExecutableToolNames } from "@freeanima/runtime/conversation";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";

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

  it("new conversation system_prompt lists ToolSets compactly", async () => {
    const c = testConv();
    const sid = await c.newConversation(TEST_SAP_CHAT_PLATFORM);
    const meta = await c.loadConversationMeta(sid);
    expect(isConversationMeta(meta)).toBe(true);
    if (!isConversationMeta(meta)) return;
    const sp = meta.system_prompt ?? "";
    expect(sp).toContain("## ToolSets");
    expect(sp).toContain("- file —");
    expect(sp).toContain("toolset_load");
  });

  it("new conversation meta stores default cached toolsets", async () => {
    const c = testConv();
    const sid = await c.newConversation(TEST_SAP_CHAT_PLATFORM);
    const meta = await c.loadConversationMeta(sid);
    expect(isConversationMeta(meta)).toBe(true);
    if (!isConversationMeta(meta)) return;

    for (const expected of DEFAULT_CONVERSATION_TOOLSETS) {
      if (getTestEngine().toolSets.getToolSet(expected)) {
        expect(meta.cached_toolsets).toContain(expected);
      }
    }
    expect(meta.staged_toolsets ?? []).toEqual([]);

    const schemas = await c.loadConversationTools(sid, meta);
    const names = schemas.map((t) => t.function.name);
    expect(names).toContain("toolset_search");
    expect(names).not.toContain("file_read");
  });

  it("toolset_load writes staged_toolsets without extending API schema", async () => {
    const c = testConv();
    const sid = await c.newConversation(TEST_SAP_CHAT_PLATFORM);
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
      { tools: getTestEngine().toolSets },
    );

    const meta = await c.loadConversationMeta(sid);
    expect(isConversationMeta(meta)).toBe(true);
    if (!isConversationMeta(meta)) return;
    expect(meta.staged_toolsets).toContain("file");

    const schemas = await c.loadConversationTools(sid, meta);
    expect(schemas.map((t) => t.function.name)).not.toContain("file_read");
  });

  it("unloaded tools are blocked by executableTools gate", async () => {
    const c = testConv();
    const sid = await c.newConversation(TEST_SAP_CHAT_PLATFORM);
    const meta = await c.loadConversationMeta(sid);
    expect(isConversationMeta(meta)).toBe(true);
    if (!isConversationMeta(meta)) return;

    const tools = await c.loadConversationTools(sid, meta);
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

    const msgs: StoredMessage[] = [
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
        { tools: getTestEngine().toolSets, executableTools },
      );
    } finally {
      chatStreamSpy.mockRestore();
    }

    const toolMsg = msgs.find((m) => m.role === "tool");
    expect(toolMsg?.content).toContain("toolset_load");
  });

  it("toolset_search requires query and returns hits", async () => {
    const c = testConv();
    const sid = await c.newConversation(TEST_SAP_CHAT_PLATFORM);
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
      { tools: getTestEngine().toolSets, executableTools: ["toolset_search"] },
    );
  });
});
