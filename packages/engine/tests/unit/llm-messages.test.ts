import { describe, it, expect } from "vitest";
import {
  finalizeStreamingToolCalls,
  mergeStreamingToolCalls,
  messagesForApi,
} from "../../src/llm.js";
import type { SessionMessage } from "../../src/schemas/message.js";

describe("mergeStreamingToolCalls", () => {
  it("merges deltas by index into one tool call with name", () => {
    let acc: Record<number, { id: string; type: "function"; function: { name: string; arguments: string } }> = {};
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
        type: "function",
        function: { name: "file", arguments: '{"path":' },
      } as never,
    ]);
    acc = mergeStreamingToolCalls(acc, [
      {
        index: 0,
        type: "function",
        function: { arguments: '"/tmp"}' },
      } as never,
    ]);
    const merged = finalizeStreamingToolCalls(acc);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.function.name).toBe("read_file");
    expect(merged[0]!.function.arguments).toBe('{"path":"/tmp"}');
  });
});

describe("messagesForApi", () => {
  it("adds name to tool messages from preceding assistant tool_calls", () => {
    const out = messagesForApi([
      { role: "system", content: "sys", timestamp: "x", pos: 1 },
      { role: "user", content: "hi", pos: 2 },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "read_file", arguments: "{}" },
          },
        ],
        model: "m",
      },
      { role: "tool", tool_call_id: "call_1", content: '{"ok":true}' },
    ]);

    expect(out[0]).toEqual({ role: "system", content: "sys" });
    expect(out[1]).toEqual({ role: "user", content: "hi" });
    expect(out[3]).toMatchObject({
      role: "tool",
      tool_call_id: "call_1",
      name: "read_file",
      content: '{"ok":true}',
    });
  });

  it("keeps name on tool messages when already set", () => {
    const out = messagesForApi([
      { role: "tool", tool_call_id: "c", name: "patch", content: "done" },
    ]);
    expect(out[0]).toMatchObject({ role: "tool", name: "patch" });
  });

  it("tool messages without resolvable name get unknown fallback", () => {
    const out = messagesForApi([{ role: "tool", tool_call_id: "c", content: "done" }]);
    expect(out[0]).toMatchObject({ role: "tool", name: "unknown" });
  });

  it("assistant with reasoning field maps to reasoning_content for API", () => {
    const out = messagesForApi([
      {
        role: "assistant",
        content: "",
        reasoning: "思考过程",
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "recall", arguments: "{}" },
          },
        ],
      },
    ]);
    expect(out[0]).toMatchObject({
      role: "assistant",
      reasoning_content: "思考过程",
    });
    expect((out[0] as Record<string, unknown>).reasoning).toBeUndefined();
  });

  it("unknown role throws instead of silently degrading to user", () => {
    expect(() =>
      messagesForApi([{ role: "bogus", content: "x" } as SessionMessage]),
    ).toThrow(/未知消息 role/);
  });
});
