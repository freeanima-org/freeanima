import { describe, expect, it } from "bun:test";

import type { AssistantMessage, StoredMessage } from "@freeanima/core/db/domain";

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

  it("drops non-leading system messages from turns", () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "hi" },
      { role: "system", content: "injected" },
      { role: "assistant", content: "ok" },
    ];
    const { turns, systemPrompt } = storedMessagesToInvokeInput(messages);
    expect(systemPrompt).toBeUndefined();
    expect(turns.map((t) => t.role)).toEqual(["user", "assistant"]);
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
