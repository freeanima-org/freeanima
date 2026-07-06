import { describe, expect, it } from "bun:test";

import type { StoredMessage } from "@freeanima/core/db/domain";
import { PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME } from "@freeanima/core/llm/runtime-system-turn";

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

  it("lists tool schemas", () => {
    const snapshot = buildLlmDebugSnapshot(
      [{ role: "user", content: "q" }],
      [
        {
          type: "function",
          function: { name: "memory_recall", description: "recall memory" },
        },
      ],
      "m",
      1,
      "final",
    );

    expect(snapshot.tool_count).toBe(1);
    expect(snapshot.tools[0]?.name).toBe("memory_recall");
    expect(snapshot.turn_index).toBe(1);
    expect(snapshot.phase).toBe("final");
  });
});
