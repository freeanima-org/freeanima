import { describe, expect, it } from "bun:test";
import type { LlmTurnMessage } from "@freeanima/engine-provider-llm";
import { messagesForApi } from "../../src/messages";

describe("messagesForApi", () => {
  it("前置 system 并映射 user/assistant/tool", () => {
    const turn: LlmTurnMessage[] = [
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "tc1", type: "function", function: { name: "grep", arguments: "{}" } }],
      },
      { role: "tool", tool_call_id: "tc1", content: "result" },
    ];
    const api = messagesForApi(turn, "  system  ");
    expect(api[0]).toEqual({ role: "system", content: "  system  " });
    expect(api[1]).toMatchObject({ role: "user", content: "hi" });
    expect(api[2]).toMatchObject({
      role: "assistant",
      tool_calls: [{ id: "tc1", type: "function", function: { name: "grep", arguments: "{}" } }],
    });
    expect(api[3]).toMatchObject({
      role: "tool",
      tool_call_id: "tc1",
      content: "result",
    });
    expect((api[3] as { name?: string }).name).toBe("grep");
  });

  it("assistant 写入 reasoning_content", () => {
    const api = messagesForApi([
      { role: "assistant", content: "ans", reasoning: "think" },
    ]);
    expect(api[0]).toMatchObject({
      role: "assistant",
      content: "ans",
      reasoning_content: "think",
    });
  });
});
