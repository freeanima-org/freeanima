import { describe, expect, it } from "bun:test";

import type { AssistantMessage, StoredMessage } from "@freeanima/host/core/db/domain";

import {
  normalizeAssistantTurn,
  simpleMessagesToInvokeInput,
  storedMessagesToInvokeInput,
} from "./llm-adapt.ts";

describe("normalizeAssistantTurn", () => {
  it("keeps assistant with tool_calls", () => {
    const msg: AssistantMessage = {
      role: "assistant",
      content: null,
      tool_calls: [
        { id: "c1", type: "function", function: { name: "read_file", arguments: "{}" } },
      ],
    };
    const out = normalizeAssistantTurn(msg);
    expect(out?.role).toBe("assistant");
    expect(out && "tool_calls" in out && out.tool_calls).toHaveLength(1);
  });

  it("uses text content when no tool_calls", () => {
    const out = normalizeAssistantTurn({ role: "assistant", content: "hello" });
    expect(out).toEqual({ role: "assistant", content: "hello" });
  });

  it("returns null for empty assistant without tools", () => {
    expect(normalizeAssistantTurn({ role: "assistant", content: "  " })).toBeNull();
  });
});

describe("storedMessagesToInvokeInput", () => {
  it("extracts leading system prompt and skips conversation_meta", () => {
    const messages: StoredMessage[] = [
      { role: "system", content: "You are helpful" },
      {
        role: "conversation_meta",
        model: "m",
        cached_toolsets: [],
        functions: [],
        timestamp: new Date().toISOString(),
      },
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ];
    const { turns, systemPrompt } = storedMessagesToInvokeInput(messages);
    expect(systemPrompt).toBe("You are helpful");
    expect(turns.map((t) => t.role)).toEqual(["user", "assistant"]);
  });

  it("folds unnamed non-leading system into systemPrompt (runtime inject before system)", () => {
    const messages: StoredMessage[] = [
      {
        role: "assistant",
        name: "temporal_summary_peers",
        content: "peer rollup",
      },
      { role: "system", content: "You are helpful" },
      { role: "user", content: "hi" },
      { role: "assistant", content: "ok" },
    ];
    const { turns, systemPrompt } = storedMessagesToInvokeInput(messages);
    expect(systemPrompt).toBe("You are helpful");
    expect(turns.map((t) => t.role)).toEqual(["assistant", "user", "assistant"]);
    expect(turns[0] && "name" in turns[0] ? turns[0].name : undefined).toBe(
      "temporal_summary_peers",
    );
  });

  it("forwards passive memory as assistant turn before provider invoke", () => {
    const messages: StoredMessage[] = [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "hi" },
      {
        role: "assistant",
        name: "passive_memory_context",
        content: "recalled memory",
      },
      { role: "user", content: "follow up" },
    ];
    const { turns, systemPrompt } = storedMessagesToInvokeInput(messages);
    expect(systemPrompt).toBe("You are helpful");
    expect(turns).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", name: "passive_memory_context", content: "recalled memory" },
      { role: "user", content: "follow up" },
    ]);
  });
});

describe("simpleMessagesToInvokeInput", () => {
  it("merges system messages and maps user/assistant turns", () => {
    const { turns, systemPrompt } = simpleMessagesToInvokeInput([
      { role: "system", content: "A" },
      { role: "system", content: "B" },
      { role: "user", content: "question" },
      { role: "assistant", content: "answer" },
    ]);
    expect(systemPrompt).toBe("A\nB");
    expect(turns).toEqual([
      { role: "user", content: "question" },
      { role: "assistant", content: "answer" },
    ]);
  });
});
