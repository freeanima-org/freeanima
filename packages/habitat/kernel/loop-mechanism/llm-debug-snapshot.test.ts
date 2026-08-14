import { describe, expect, it } from "bun:test";

import type { StoredMessage } from "@freeanima/habitat/core/db/domain";
import { PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME } from "@freeanima/habitat/core/llm/runtime-system-turn";

import { buildLlmDebugSnapshot, LLM_DEBUG_CONTENT_MAX } from "./llm-debug-snapshot.ts";

describe("buildLlmDebugSnapshot", () => {
  it("maps stored messages to invoke preview with system prompt split", () => {
    const messages: StoredMessage[] = [
      { role: "system", content: "global system" },
      { role: "user", content: "hello" },
    ];
    const snapshot = buildLlmDebugSnapshot(messages, [], "gpt-test", 0, "initial");

    expect(snapshot.phase).toBe("initial");
    expect(snapshot.model).toBe("gpt-test");
    expect(snapshot.invoke.system_prompt).toBe("global system");
    expect(snapshot.invoke.turns).toEqual([{ role: "user", content: "hello" }]);
  });

  it("still surfaces system prompt when a runtime inject precedes it", () => {
    const messages: StoredMessage[] = [
      {
        role: "assistant",
        name: "temporal_summary_peers",
        content: "peer rollup",
      },
      { role: "system", content: "global system" },
      { role: "user", content: "hello" },
    ];
    const snapshot = buildLlmDebugSnapshot(messages, [], "gpt-test", 0, "initial");
    expect(snapshot.invoke.system_prompt).toBe("global system");
  });

  it("detects passive memory runtime injection", () => {
    const messages: StoredMessage[] = [
      { role: "system", content: "global" },
      { role: "user", content: "earlier" },
      {
        role: "assistant",
        name: PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME,
        content: "recalled facts",
      },
      { role: "user", content: "current" },
    ];
    const snapshot = buildLlmDebugSnapshot(messages, [], "m", 0, "initial");

    expect(snapshot.runtime_injections?.passive_memory_context).toBe(true);
    expect(
      snapshot.invoke.turns.some((t) => t.name === PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME),
    ).toBe(true);
  });

  it("truncates long content", () => {
    const long = "x".repeat(LLM_DEBUG_CONTENT_MAX + 100);
    const messages: StoredMessage[] = [
      { role: "system", content: long },
      { role: "user", content: "hi" },
    ];
    const snapshot = buildLlmDebugSnapshot(messages, [], "m", 0, "final");

    expect(snapshot.invoke.system_prompt?.includes("[truncated")).toBe(true);
    expect(snapshot.invoke.system_prompt!.length).toBeLessThan(long.length);
  });

  it("attaches passive_recall extras when provided", () => {
    const messages: StoredMessage[] = [{ role: "user", content: "你的邮箱是啥？" }];
    const snapshot = buildLlmDebugSnapshot(messages, [], "m", 0, "initial", {
      passive_recall: {
        query: "你的邮箱是啥？",
        tsquery: "(邮 <-> 箱)",
        effective_min_score: 0.016,
        min_score: 0.016,
        min_relative_score: 0.55,
        fts: [{ id: 1, score: 0.2, content_preview: "邮箱…" }],
        trgm: [],
        merged: [{ id: 1, score: 0.016, content_preview: "邮箱…" }],
        after_score_filter: [{ id: 1, score: 0.016, content_preview: "邮箱…" }],
        after_resident_filter: [{ id: 1, score: 0.016, content_preview: "邮箱…" }],
        excluded_resident_ids: [],
        injected: [{ id: 1, score: 0.016, content_preview: "邮箱…" }],
        elapsed_ms: 12,
      },
    });
    expect(snapshot.passive_recall?.query).toBe("你的邮箱是啥？");
    expect(snapshot.passive_recall?.fts).toHaveLength(1);
  });

  it("lists full tool schemas as sent to the provider", () => {
    const snapshot = buildLlmDebugSnapshot(
      [{ role: "user", content: "q" }],
      [
        {
          type: "function",
          function: {
            name: "memory_semantic_search",
            description:
              'recall memory\n\nReturns (JSON Schema): {"type":"object","properties":{"items":{"type":"array"}}}',
            parameters: { type: "object", properties: { query: { type: "string" } } },
          },
        },
      ],
      "m",
      1,
      "final",
    );

    expect(snapshot.tool_count).toBe(1);
    expect(snapshot.tools[0]?.function.name).toBe("memory_semantic_search");
    expect(snapshot.tools[0]?.function.description).toContain("Returns (JSON Schema):");
    expect(snapshot.turn_index).toBe(1);
    expect(snapshot.phase).toBe("final");
  });
});
