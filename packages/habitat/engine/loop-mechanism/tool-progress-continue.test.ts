import { describe, expect, it, spyOn, afterEach } from "bun:test";
import type { StoredMessage } from "@freeanima/habitat/core/db/domain";
import {
  ToolSetRegistry,
  reportToolProgress,
  runWithToolContext,
  setToolProgressReporter,
  toolResult,
} from "@freeanima/habitat/core/tool";
import * as llm from "@freeanima/habitat/core/llm";
import { runStream } from "./loop-engine.ts";

describe("runStream subagent-like tool progress", () => {
  let chatSpy: ReturnType<typeof spyOn<typeof llm, "chatStream">> | null = null;

  afterEach(() => {
    chatSpy?.mockRestore();
    chatSpy = null;
  });

  it("continues to the next LLM hop after progress + nested AutoLlm context", async () => {
    let hop = 0;
    chatSpy = spyOn(llm, "chatStream").mockImplementation(async function* () {
      hop += 1;
      if (hop === 1) {
        yield {
          type: "tool_calls" as const,
          tool_calls: [
            {
              id: "c1",
              type: "function",
              function: {
                name: "slow_child",
                arguments: JSON.stringify({ _title: "跑子任务" }),
              },
            },
          ],
        };
        yield { type: "done" as const, finish_reason: "tool_calls" };
        return;
      }
      yield { type: "content" as const, content: "continued" };
      yield { type: "done" as const, finish_reason: "stop" };
    });

    const registry = new ToolSetRegistry();
    registry.registerToolSet("t", "t", [
      {
        name: "slow_child",
        description: "nested progress",
        parameters: { type: "object", properties: {} },
        handler: async () => {
          reportToolProgress(
            JSON.stringify({
              ok: true,
              results: [{ steps: [{ name: "inner", status: "running" }] }],
            }),
          );
          await runWithToolContext(
            "child-run",
            async () => {
              reportToolProgress(
                JSON.stringify({
                  ok: true,
                  results: [{ steps: [{ name: "inner", status: "done" }] }],
                }),
              );
              // 子 AutoLlm 结束时不得把父对话的 progress sink 清掉
              setToolProgressReporter(undefined);
            },
            { tools: registry, contextKind: "auto_llm" },
          );
          return toolResult({ ok: true });
        },
      },
    ]);

    const events: string[] = [];
    const msgs: StoredMessage[] = [{ role: "user", content: "go" }];
    await runWithToolContext(
      "parent-conv",
      async () => {
        for await (const ev of runStream(msgs, {
          model: "test-model",
          tools: registry.openaiSchemas(),
          toolRegistry: registry,
          toolProgress: true,
          executableTools: ["slow_child"],
        })) {
          events.push(ev.event);
        }
      },
      { tools: registry, contextKind: "conversation" },
    );

    expect(events).toContain("tool_begin");
    expect(events).toContain("tool_progress");
    expect(events).toContain("tool_result");
    expect(events).toContain("tool_round_end");
    expect(events).toContain("token");
    expect(events).toContain("done");
    expect(events.indexOf("tool_round_end")).toBeLessThan(events.indexOf("token"));
    expect(hop).toBe(2);
  });
});
