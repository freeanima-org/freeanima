import { describe, expect, it } from "bun:test";
import { normalizeUsage } from "./usage.ts";

describe("normalizeUsage", () => {
  it("maps OpenAI-style fields", () => {
    expect(
      normalizeUsage({
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      }),
    ).toEqual({
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    });
  });

  it("maps input/output aliases and nested cached", () => {
    expect(
      normalizeUsage({
        input_tokens: 100,
        output_tokens: 20,
        input_tokens_details: { cached_tokens: 40 },
      }),
    ).toEqual({
      prompt_tokens: 100,
      completion_tokens: 20,
      cached_tokens: 40,
    });
  });

  it("returns null when empty or no mappable fields", () => {
    expect(normalizeUsage(null)).toBeNull();
    expect(normalizeUsage({})).toBeNull();
  });
});
