import { describe, expect, test } from "bun:test";
import { collectChatCompletion } from "./collect-chat.ts";
import type { ChatStreamEvent } from "./invoke.ts";

describe("collectChatCompletion", () => {
  test("joins content and copies done metadata", async () => {
    async function* stream(): AsyncGenerator<ChatStreamEvent> {
      yield { type: "content", content: "你" };
      yield { type: "content", content: "好" };
      yield {
        type: "done",
        reasoning: "think",
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
        finish_reason: "stop",
        model: "m1",
      };
    }
    const out = await collectChatCompletion(stream());
    expect(out.content).toBe("你好");
    expect(out.reasoning).toBe("think");
    expect(out.usage).toEqual({ prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 });
    expect(out.finish_reason).toBe("stop");
    expect(out.model).toBe("m1");
    expect(out.tool_calls).toBeNull();
    expect(out.latency_ms).toBeGreaterThanOrEqual(0);
  });

  test("empty content with tool_calls becomes null", async () => {
    async function* stream(): AsyncGenerator<ChatStreamEvent> {
      yield {
        type: "tool_calls",
        tool_calls: [{ id: "c1", type: "function", function: { name: "fn", arguments: "{}" } }],
      };
      yield { type: "done", finish_reason: "tool_calls", model: "m" };
    }
    const out = await collectChatCompletion(stream());
    expect(out.content).toBeNull();
    expect(out.tool_calls?.[0]?.function.name).toBe("fn");
    expect(out.finish_reason).toBe("tool_calls");
  });
});
