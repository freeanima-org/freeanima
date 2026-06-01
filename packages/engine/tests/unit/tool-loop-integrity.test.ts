import { describe, it, expect } from "vitest";
import {
  detectToolLoopCorruption,
  repairToolLoopMessages,
  planToolLoopInserts,
  isInsufficientToolMessagesError,
  REPAIR_REASON_LOST,
  syntheticToolContent,
} from "../../src/tool-loop-integrity.js";
import { messagesForApi } from "../../src/llm.js";
import type { SessionMessage } from "@freeanima/kernel";

describe("tool-loop-integrity", () => {
  it("detectToolLoopCorruption 发现 dangling assistant", () => {
    const msgs: SessionMessage[] = [
      { role: "user", content: "hi", id: 1 },
      {
        role: "assistant",
        content: null,
        id: 2,
        tool_calls: [
          { id: "call_1", type: "function", function: { name: "read_file", arguments: "{}" } },
          { id: "call_2", type: "function", function: { name: "grep", arguments: "{}" } },
        ],
      },
      { role: "tool", tool_call_id: "call_1", name: "read_file", content: '{"ok":true}', id: 3 },
    ];
    const issues = detectToolLoopCorruption(msgs);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.missingCalls).toEqual([{ id: "call_2", name: "grep" }]);
  });

  it("repairToolLoopMessages 补 synthetic tool 并剔除 orphan", () => {
    const msgs: SessionMessage[] = [
      { role: "user", content: "hi", id: 1 },
      {
        role: "assistant",
        content: null,
        id: 2,
        tool_calls: [
          { id: "call_1", type: "function", function: { name: "read_file", arguments: "{}" } },
        ],
      },
      { role: "tool", tool_call_id: "orphan", name: "x", content: "bad", id: 3 },
    ];
    const repaired = repairToolLoopMessages(msgs);
    expect(repaired).toHaveLength(3);
    expect(repaired[2]?.role).toBe("tool");
    if (repaired[2]?.role === "tool") {
      expect(repaired[2].tool_call_id).toBe("call_1");
      expect(repaired[2].content).toBe(syntheticToolContent(REPAIR_REASON_LOST));
    }
    const api = messagesForApi(repaired);
    expect(api.some((m) => m.role === "assistant" && "tool_calls" in m && m.tool_calls?.length)).toBe(
      true,
    );
  });

  it("planToolLoopInserts 在中间 assistant 后插入而非末尾", () => {
    const msgs: SessionMessage[] = [
      { role: "user", content: "u1", id: 489 },
      {
        role: "assistant",
        content: null,
        id: 490,
        tool_calls: [
          { id: "call_1", type: "function", function: { name: "read_file", arguments: "{}" } },
        ],
      },
      { role: "user", content: "u2", id: 491 },
      { role: "assistant", content: "ok", id: 500 },
    ];
    const plans = planToolLoopInserts(msgs);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.insertAtPos).toBe(491);
    expect(plans[0]?.missingCalls[0]?.id).toBe("call_1");
  });

  it("isInsufficientToolMessagesError 识别 provider 400 文案", () => {
    expect(
      isInsufficientToolMessagesError(
        "400 Error from provider (DeepSeek): insufficient tool messages following tool_calls message",
      ),
    ).toBe(true);
    expect(isInsufficientToolMessagesError("network timeout")).toBe(false);
  });
});
