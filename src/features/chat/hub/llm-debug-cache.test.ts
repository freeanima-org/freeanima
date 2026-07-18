import { beforeEach, describe, expect, it } from "bun:test";

import { resetCacheMemoryForTests } from "@freeanima/platform/connectors/redis";

import {
  LLM_DEBUG_CACHE_TTL_SECONDS,
  loadLlmDebugCache,
  llmDebugCacheKey,
  rememberLlmDebugFromStreamPayload,
} from "./llm-debug-cache.ts";

describe("llm-debug-cache", () => {
  beforeEach(() => {
    resetCacheMemoryForTests();
  });

  it("uses anima:cache:llm-debug:{conversation_id} key and 10min TTL constant", () => {
    expect(llmDebugCacheKey("c1")).toBe("anima:cache:llm-debug:c1");
    expect(LLM_DEBUG_CACHE_TTL_SECONDS).toBe(600);
  });

  it("merges initial/final snapshots and rolls overwrite", async () => {
    await rememberLlmDebugFromStreamPayload("c1", {
      stream_id: "s1",
      phase: "initial",
      turn_index: 0,
      model: "m",
      tool_count: 0,
      tools: [],
      invoke: { turns: [{ role: "user", content: "hi" }] },
    });
    await rememberLlmDebugFromStreamPayload("c1", {
      stream_id: "s1",
      phase: "final",
      turn_index: 1,
      model: "m",
      tool_count: 1,
      tools: [{ name: "t" }],
      invoke: { system_prompt: "sys", turns: [{ role: "user", content: "hi" }] },
    });

    const cached = await loadLlmDebugCache("c1");
    expect(cached?.initial?.phase).toBe("initial");
    expect(cached?.final?.phase).toBe("final");
    expect(cached?.final?.invoke.system_prompt).toBe("sys");
    expect(cached?.updated_at).toBeTruthy();
  });
});
