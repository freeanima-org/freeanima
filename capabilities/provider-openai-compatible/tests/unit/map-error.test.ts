import { describe, expect, it } from "bun:test";
import { APIError } from "openai";
import { ProviderError } from "@freeanima/engine-provider-llm";
import { mapOpenAiCompatibleError } from "../../src/map-error.ts";

describe("mapOpenAiCompatibleError", () => {
  it("透传已有 ProviderError", () => {
    const original = new ProviderError("x", "cancelled", false);
    expect(mapOpenAiCompatibleError(original)).toBe(original);
  });

  it("将 APIError 映射为 ProviderError", () => {
    const err = mapOpenAiCompatibleError(new APIError(429, {}, "rate", new Headers()), {
      providerId: "main",
    });
    expect(err.code).toBe("rate_limited");
    expect(err.retryable).toBe(true);
    expect(err.providerId).toBe("main");
  });

  it("识别 timeout 与 Abort", () => {
    const timeout = mapOpenAiCompatibleError(new Error("request timed out"));
    expect(timeout.code).toBe("timeout");
    expect(timeout.retryable).toBe(true);

    const abort = new Error("aborted");
    abort.name = "AbortError";
    const cancelled = mapOpenAiCompatibleError(abort);
    expect(cancelled.code).toBe("cancelled");
    expect(cancelled.retryable).toBe(false);
  });
});
