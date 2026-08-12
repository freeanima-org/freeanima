import { describe, expect, it } from "bun:test";

import type { StoredMessage } from "@freeanima/host/core/db/domain";
import { PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME } from "@freeanima/host/core/llm/runtime-system-turn";

import type { SemanticRecallHit } from "../recall-search.ts";
import {
  formatPassiveMemoryBlock,
  isPassiveMemoryContextAssistant,
  manifestPassiveMemoryContext,
  stripPassiveMemoryContextFromMessages,
} from "./inject.ts";
import { stripTimePrefixFromUserContent } from "./query.ts";

const sampleHit = (id: number, content: string): SemanticRecallHit => ({
  memory_type: "semantic",
  score: 0.8,
  semantic_memory_id: id,
  type: "world",
  pinned: false,
  content,
  source_conversations: [],
  observed_at: null,
  occurred_at: null,
  status: "active",
});

describe("stripTimePrefixFromUserContent", () => {
  it("strips runtime time prefix", () => {
    expect(stripTimePrefixFromUserContent("<time>2026-06-07T17:45 周日</time>\nhello")).toBe(
      "hello",
    );
    expect(stripTimePrefixFromUserContent("<time>2026-06-07T17:45</time>\nhello")).toBe("hello");
  });

  it("leaves plain content unchanged", () => {
    expect(stripTimePrefixFromUserContent("hello")).toBe("hello");
  });
});

describe("passive recall inject", () => {
  it("formats memory block with citation markers", () => {
    const block = formatPassiveMemoryBlock([sampleHit(4057, "Alice lives in Shanghai")], 500);
    expect(block).toContain("[[anima:4057]] Alice lives in Shanghai");
    expect(block).toContain("<passive_memory>");
    expect(block).toContain("</passive_memory>");
  });

  it("manifest inserts runtime assistant before last user message", () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "earlier" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "current" },
    ];
    manifestPassiveMemoryContext(messages, [sampleHit(1291, "prefers TS")], 2000);
    expect(messages).toHaveLength(4);
    const injected = messages[2];
    expect(injected?.role).toBe("assistant");
    expect(isPassiveMemoryContextAssistant(injected!)).toBe(true);
    if (injected?.role === "assistant") {
      expect(injected.name).toBe(PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME);
      expect(injected.content).toContain("prefers TS");
    }
    expect(messages[3]).toEqual({ role: "user", content: "current" });
  });

  it("strip removes prior passive memory assistant messages", () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "q" },
      {
        role: "assistant",
        name: PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME,
        content: "old recall",
      },
      { role: "user", content: "q2" },
    ];
    stripPassiveMemoryContextFromMessages(messages);
    expect(messages).toHaveLength(2);
    expect(messages.every((m) => !isPassiveMemoryContextAssistant(m))).toBe(true);
  });

  it("skips manifest when max chars too small", () => {
    const messages: StoredMessage[] = [{ role: "user", content: "q" }];
    manifestPassiveMemoryContext(
      messages,
      [sampleHit(2028, "a very long semantic memory content")],
      5,
    );
    expect(messages).toHaveLength(1);
  });
});
