import { describe, expect, it } from "bun:test";

import { assistantReasoningText, resolveMaxTurns } from "./message-fields.ts";

describe("assistantReasoningText", () => {
  it("prefers reasoning over reasoning_content", () => {
    expect(
      assistantReasoningText({
        role: "assistant",
        content: null,
        reasoning: " primary ",
        reasoning_content: "secondary",
      }),
    ).toBe("primary");
  });

  it("falls back to reasoning_content", () => {
    expect(
      assistantReasoningText({
        role: "assistant",
        content: null,
        reasoning_content: " chain ",
      }),
    ).toBe("chain");
  });

  it("returns empty when neither field set", () => {
    expect(assistantReasoningText({ role: "assistant", content: null })).toBe("");
  });
});

describe("resolveMaxTurns", () => {
  it("reads max_turns wire field", () => {
    expect(resolveMaxTurns({ max_turns: 12 })).toBe(12);
  });

  it("reads maxTurns runtime field", () => {
    expect(resolveMaxTurns({ maxTurns: 8 })).toBe(8);
  });

  it("prefers max_turns over maxTurns", () => {
    expect(resolveMaxTurns({ max_turns: 3, maxTurns: 9 })).toBe(3);
  });

  it("uses fallback for missing or non-finite values", () => {
    expect(resolveMaxTurns()).toBe(98);
    expect(resolveMaxTurns({ max_turns: Number.NaN }, 10)).toBe(10);
  });
});
