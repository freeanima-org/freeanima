import { describe, expect, it } from "bun:test";
import type { LlmTurnMessage } from "@freeanima/core/provider";
import { messagesForApi } from "./messages.ts";

describe("messagesForApi", () => {
  it("prepends system and maps user/assistant/tool", () => {
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

  it("assistant writes reasoning_content", () => {
    const api = messagesForApi([{ role: "assistant", content: "ans", reasoning: "think" }]);
    expect(api[0]).toMatchObject({
      role: "assistant",
      content: "ans",
      reasoning_content: "think",
    });
  });

  it("passes assistant name to API", () => {
    const api = messagesForApi([
      { role: "assistant", name: "notification_context", content: "unread notes" },
      { role: "user", content: "hi" },
    ]);
    expect(api[0]).toMatchObject({
      role: "assistant",
      name: "notification_context",
      content: "unread notes",
    });
  });

  it("maps mid-conversation passive memory assistant turns", () => {
    const api = messagesForApi(
      [
        { role: "user", content: "hi" },
        { role: "assistant", name: "passive_memory_context", content: "memory block" },
        { role: "user", content: "follow up" },
      ],
      "leading system",
    );
    expect(api[0]).toEqual({ role: "system", content: "leading system" });
    expect(api[1]).toMatchObject({ role: "user", content: "hi" });
    expect(api[2]).toMatchObject({
      role: "assistant",
      name: "passive_memory_context",
      content: "memory block",
    });
    expect(api[3]).toMatchObject({ role: "user", content: "follow up" });
  });
});
