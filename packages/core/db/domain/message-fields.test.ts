import { describe, expect, it } from "bun:test";

import { assistantReasoningText, resolveMaxLoopIterations } from "./message-fields.ts";

describe("assistantReasoningText", () => {
  it("reads reasoning field", () => {
    expect(
      assistantReasoningText({
        role: "assistant",
        content: null,
        reasoning: " chain ",
      }),
    ).toBe("chain");
  });

  it("returns empty when reasoning unset", () => {
    expect(assistantReasoningText({ role: "assistant", content: null })).toBe("");
  });
});

describe("resolveMaxLoopIterations", () => {
  it("reads max_loop_iterations protocol field", () => {
    expect(resolveMaxLoopIterations({ max_loop_iterations: 12 })).toBe(12);
  });

  it("reads maxLoopIterations runtime field", () => {
    expect(resolveMaxLoopIterations({ maxLoopIterations: 8 })).toBe(8);
  });

  it("prefers max_loop_iterations over maxLoopIterations", () => {
    expect(resolveMaxLoopIterations({ max_loop_iterations: 3, maxLoopIterations: 9 })).toBe(3);
  });

  it("uses fallback for missing or non-finite values", () => {
    expect(resolveMaxLoopIterations()).toBe(98);
    expect(resolveMaxLoopIterations({ max_loop_iterations: Number.NaN }, 10)).toBe(10);
  });
});
