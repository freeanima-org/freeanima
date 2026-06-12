import { describe, it, expect } from "bun:test";
import {
  detectToolLoopCorruption,
  repairToolLoopMessages,
  planToolLoopInserts,
  isInsufficientToolMessagesError,
  REPAIR_REASON_LOST,
  syntheticToolContent,
  sessionMessagesToInvokeInput,
  normalizeAssistantTurn,
} from "./index.ts";
import { messagesForApi } from "@freeanima/capabilities-llm-openai/messages";
import type { SessionMessage } from "@freeanima/core/db/domain";
describe("tool-loop-integrity", () => {
  it("detectToolLoopCorruption finds dangling assistant", () => {
    const msgs: SessionMessage[] = [
      { role: "user", content: "hi", pos: 1 },
      {
        role: "assistant",
        content: null,
        pos: 2,
        tool_calls: [
          { id: "call_1", type: "function", function: { name: "file_read_file", arguments: "{}" } },
          { id: "call_2", type: "function", function: { name: "grep", arguments: "{}" } },
        ],
      },
      {
        role: "tool",
        tool_call_id: "call_1",
        name: "file_read_file",
        content: '{"ok":true}',
        pos: 3,
      },
    ];
    const issues = detectToolLoopCorruption(msgs);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.missingCalls).toEqual([{ id: "call_2", name: "grep" }]);
  });

  it("repairToolLoopMessages adds synthetic tool and drops orphan", () => {
    const msgs: SessionMessage[] = [
      { role: "user", content: "hi", pos: 1 },
      {
        role: "assistant",
        content: null,
        pos: 2,
        tool_calls: [
          { id: "call_1", type: "function", function: { name: "file_read_file", arguments: "{}" } },
        ],
      },
      { role: "tool", tool_call_id: "orphan", name: "x", content: "bad", pos: 3 },
    ];
    const repaired = repairToolLoopMessages(msgs);
    expect(repaired).toHaveLength(3);
    expect(repaired[2]?.role).toBe("tool");
    if (repaired[2]?.role === "tool") {
      expect(repaired[2].tool_call_id).toBe("call_1");
      expect(repaired[2].content).toBe(syntheticToolContent(REPAIR_REASON_LOST));
    }
    const api = messagesForApi(sessionMessagesToInvokeInput(repaired).turns);
    expect(
      api.some((m) => m.role === "assistant" && "tool_calls" in m && m.tool_calls?.length),
    ).toBe(true);
  });

  it("planToolLoopInserts inserts after middle assistant not at end", () => {
    const msgs: SessionMessage[] = [
      { role: "user", content: "u1", pos: 489 },
      {
        role: "assistant",
        content: null,
        pos: 490,
        tool_calls: [
          { id: "call_1", type: "function", function: { name: "file_read_file", arguments: "{}" } },
        ],
      },
      { role: "user", content: "u2", pos: 491 },
      { role: "assistant", content: "ok", pos: 500 },
    ];
    const plans = planToolLoopInserts(msgs);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.insertAtPos).toBe(491);
    expect(plans[0]?.missingCalls[0]?.id).toBe("call_1");
  });

  it("normalizeAssistantTurn drops assistant with no body and no tool_calls", () => {
    expect(normalizeAssistantTurn({ role: "assistant", content: null })).toBeNull();
    const api = messagesForApi(
      sessionMessagesToInvokeInput([
        { role: "user", content: "hi", pos: 1 },
        { role: "assistant", content: null, pos: 2 },
        { role: "user", content: "again", pos: 3 },
      ]).turns,
    );
    expect(api.map((m) => m.role)).toEqual(["user", "user"]);
  });

  it("repairToolLoopMessages skips orphan tool when stripping invalid tool_calls", () => {
    const msgs: SessionMessage[] = [
      { role: "user", content: "hi", pos: 1 },
      {
        role: "assistant",
        content: null,
        pos: 2,
        tool_calls: [{ id: "", type: "function", function: { name: "bad", arguments: "{}" } }],
      },
      { role: "tool", tool_call_id: "orphan", name: "bad", content: "x", pos: 3 },
      { role: "user", content: "next", pos: 4 },
    ];
    const repaired = repairToolLoopMessages(msgs);
    expect(repaired.map((m) => m.role)).toEqual(["user", "user"]);
  });

  it("isInsufficientToolMessagesError recognizes provider 400 message", () => {
    expect(
      isInsufficientToolMessagesError(
        "400 Error from provider (DeepSeek): insufficient tool messages following tool_calls message",
      ),
    ).toBe(true);
    expect(isInsufficientToolMessagesError("network timeout")).toBe(false);
  });
});
