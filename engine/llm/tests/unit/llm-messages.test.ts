import { describe, it, expect } from "bun:test";
import {
  finalizeStreamingToolCalls,
  mergeStreamingToolCalls,
} from "@freeanima/capabilities-provider-openai-compatible/stream-tools";
import { messagesForApi } from "@freeanima/capabilities-provider-openai-compatible/messages";
import type { LlmTurnMessage } from "@freeanima/legacy-db";

describe("mergeStreamingToolCalls", () => {
  it("merges deltas by index into one tool call with name", () => {
    let acc: Record<number, import("@freeanima/legacy-db").ToolCall> = {};
    acc = mergeStreamingToolCalls(acc, [
      {
        index: 0,
        id: "call_1",
        type: "function",
        function: { name: "read_", arguments: "" },
      } as never,
    ]);
    acc = mergeStreamingToolCalls(acc, [
      {
        index: 0,
        id: "call_1",
        type: "function",
        function: { name: "", arguments: '{"path":' },
      } as never,
    ]);
    const out = finalizeStreamingToolCalls(acc);
    expect(out).toHaveLength(1);
    expect(out[0]?.function.name).toBe("read_");
    expect(out[0]?.function.arguments).toContain("path");
  });
});

describe("messagesForApi", () => {
  it("prepends system prompt and maps user message", () => {
    const out = messagesForApi([{ role: "user", content: "hi" }], "You are helpful");
    expect(out[0]).toEqual({ role: "system", content: "You are helpful" });
    expect(out[1]).toMatchObject({ role: "user", content: "hi" });
  });

  it("resolves tool name from prior assistant tool_calls", () => {
    const msgs: LlmTurnMessage[] = [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          { id: "c1", type: "function", function: { name: "read_file", arguments: "{}" } },
        ],
      },
      { role: "tool", tool_call_id: "c1", content: "ok" },
    ];
    const out = messagesForApi(msgs);
    const tool = out.find((m) => m.role === "tool");
    expect(tool).toBeDefined();
    expect((tool as { name?: string }).name).toBe("read_file");
  });
});
