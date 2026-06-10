import { expect, it, beforeEach, afterEach, afterAll, spyOn } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import type { SessionMessage } from "@freeanima/engine-db/domain";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { getTestEngine, testConv } from "../../helpers/pg-test.ts";
import { registerAllTools } from "@freeanima/service";
import { isSessionMeta } from "@freeanima/engine-db/domain";
import { DEFAULT_SESSION_TOOL_NAMES } from "@freeanima/engine-tool";
import { runWithToolContext } from "@freeanima/engine-loop";
import * as engine from "@freeanima/engine-loop";
import * as llm from "@freeanima/engine-llm";

describePg("tool catalog lazy load", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("anima-tool-catalog-");
    const eng = getTestEngine();
    registerAllTools({ toolSets: eng.toolSets, skills: eng.skills });
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("new session schema 仅含默认工具", async () => {
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

  it("tools_load 写入 loaded_tools 但不扩展 schema", async () => {
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

  it("未 load 的工具被 executableTools 门禁拦截", async () => {
    const c = testConv();
    const sid = await c.newSession("parlor");
    const meta = await c.loadSessionMeta(sid);
    expect(isSessionMeta(meta)).toBe(true);
    if (!isSessionMeta(meta)) return;

    const tools = await c.loadSessionTools(sid, meta);
    const executableTools = [...meta.tools, ...(meta.loaded_tools ?? [])];

    getTestEngine().toolSets.registerToolSet("__gate_test__", "测试", [
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
});
