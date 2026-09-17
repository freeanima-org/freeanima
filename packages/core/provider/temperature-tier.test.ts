import { describe, expect, it } from "bun:test";

import {
  DEFAULT_SAMPLING_RANGES,
  isClaudeModelId,
  resolveSamplingRanges,
  temperatureTierToCallParams,
} from "./temperature-tier.ts";

describe("isClaudeModelId", () => {
  it("matches common Claude ids", () => {
    expect(isClaudeModelId("claude-3-5-sonnet")).toBe(true);
    expect(isClaudeModelId("anthropic/claude-sonnet-4")).toBe(true);
    expect(isClaudeModelId("openrouter/claude-3-opus")).toBe(true);
  });

  it("rejects non-Claude ids", () => {
    expect(isClaudeModelId("gpt-4o")).toBe(false);
    expect(isClaudeModelId("deepseek-chat")).toBe(false);
  });
});

describe("resolveSamplingRanges", () => {
  it("defaults to [0,1] when format unknown", () => {
    expect(resolveSamplingRanges(undefined, "gpt-4o")).toEqual(DEFAULT_SAMPLING_RANGES);
    expect(resolveSamplingRanges("custom_format", "some-model")).toEqual(DEFAULT_SAMPLING_RANGES);
  });

  it("keeps [0,1] for anthropic_messages", () => {
    expect(resolveSamplingRanges("anthropic_messages", "claude-3-5-sonnet")).toEqual(
      DEFAULT_SAMPLING_RANGES,
    );
  });

  it("keeps [0,1] for Claude via openai_compatible", () => {
    expect(resolveSamplingRanges("openai_compatible", "anthropic/claude-sonnet-4")).toEqual(
      DEFAULT_SAMPLING_RANGES,
    );
  });

  it("widens temperature to [0,2] for OpenAI family non-Claude", () => {
    expect(resolveSamplingRanges("openai_compatible", "gpt-4o")).toEqual({
      temperature: { min: 0, max: 2 },
      topP: { min: 0, max: 1 },
    });
    expect(resolveSamplingRanges("openai_responses", "gpt-5")).toEqual({
      temperature: { min: 0, max: 2 },
      topP: { min: 0, max: 1 },
    });
  });
});

describe("temperatureTierToCallParams", () => {
  it("maps tiers on default [0,1]", () => {
    expect(temperatureTierToCallParams("focused")).toEqual({ temperature: 0.2, topP: 0.8 });
    expect(temperatureTierToCallParams("balanced")).toEqual({ temperature: 0.6, topP: 0.9 });
    expect(temperatureTierToCallParams("creative")).toEqual({ temperature: 1, topP: 0.95 });
  });

  it("maps tiers on OpenAI [0,2] temperature span", () => {
    const ranges = resolveSamplingRanges("openai_compatible", "gpt-4o");
    expect(temperatureTierToCallParams("focused", ranges)).toEqual({
      temperature: 0.4,
      topP: 0.8,
    });
    expect(temperatureTierToCallParams("balanced", ranges)).toEqual({
      temperature: 1.2,
      topP: 0.9,
    });
    expect(temperatureTierToCallParams("creative", ranges)).toEqual({
      temperature: 2,
      topP: 0.95,
    });
  });

  it("anthropic_messages emits temperature only when supported", () => {
    const params = temperatureTierToCallParams("creative", DEFAULT_SAMPLING_RANGES, {
      format: "anthropic_messages",
      modelInfo: { supportedParams: ["temperature", "topP", "maxOutputTokens"] },
    });
    expect(params).toEqual({ temperature: 1 });
  });

  it("anthropic falls back to topP when temperature unsupported", () => {
    const params = temperatureTierToCallParams("focused", DEFAULT_SAMPLING_RANGES, {
      format: "anthropic_messages",
      modelInfo: { supportedParams: ["topP"] },
    });
    expect(params).toEqual({ topP: 0.8 });
  });

  it("filters by supportedParams for OpenAI family", () => {
    const ranges = resolveSamplingRanges("openai_compatible", "gpt-4o");
    expect(
      temperatureTierToCallParams("balanced", ranges, {
        modelInfo: { supportedParams: ["temperature"] },
      }),
    ).toEqual({ temperature: 1.2 });
  });
});
