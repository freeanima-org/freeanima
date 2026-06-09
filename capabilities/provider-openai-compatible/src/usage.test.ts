import { describe, expect, it } from "bun:test";
import { normalizeUsage } from "./usage.ts";

describe("normalizeUsage", () => {
  it("映射 OpenAI 风格字段", () => {
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

  it("映射 input/output 别名与嵌套 cached", () => {
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

  it("空或无可映射字段时返回 null", () => {
    expect(normalizeUsage(null)).toBeNull();
    expect(normalizeUsage({})).toBeNull();
  });
});
