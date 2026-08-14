import { describe, expect, it } from "bun:test";
import { APIConnectionError, APIError } from "openai";
import { ProviderError } from "@freeanima/habitat/core/provider";
import { mapOpenAiCompatibleError } from "./map-error.ts";
import { LlmTimeoutError } from "./request-timeouts.ts";

describe("mapOpenAiCompatibleError", () => {
  it("passes through existing ProviderError", () => {
    const original = new ProviderError("x", "cancelled", false);
    expect(mapOpenAiCompatibleError(original)).toBe(original);
  });

  it("maps APIError to ProviderError", () => {
    const err = mapOpenAiCompatibleError(new APIError(429, {}, "rate", new Headers()), {
      providerId: "main",
    });
    expect(err.code).toBe("rate_limited");
    expect(err.retryable).toBe(true);
    expect(err.providerId).toBe("main");
  });

  it("recognizes timeout and Abort", () => {
    const timeout = mapOpenAiCompatibleError(new Error("request timed out"));
    expect(timeout.code).toBe("timeout");
    expect(timeout.retryable).toBe(true);

    const abort = new Error("aborted");
    abort.name = "AbortError";
    const cancelled = mapOpenAiCompatibleError(abort);
    expect(cancelled.code).toBe("cancelled");
    expect(cancelled.retryable).toBe(false);
  });

  it("maps LlmTimeoutError kinds to timeout (not cancelled)", () => {
    for (const kind of ["first_byte", "overall", "idle"] as const) {
      const err = mapOpenAiCompatibleError(new LlmTimeoutError(kind, 1000), {
        providerId: "main",
      });
      expect(err.code).toBe("timeout");
      expect(err.retryable).toBe(true);
      expect(err.message).toContain(kind);
      expect(err.providerId).toBe("main");
    }

    const wrapped = new Error("aborted", {
      cause: new LlmTimeoutError("first_byte", 30_000),
    });
    wrapped.name = "AbortError";
    const mapped = mapOpenAiCompatibleError(wrapped);
    expect(mapped.code).toBe("timeout");
    expect(mapped.message).toContain("first_byte");
  });

  it("maps connection / socket errors to retryable unavailable", () => {
    const socket = new Error("The socket connection was closed unexpectedly");
    const conn = new Error("Connection error.", { cause: socket });
    const err = mapOpenAiCompatibleError(conn);
    expect(err.code).toBe("unavailable");
    expect(err.retryable).toBe(true);

    const apiConn = new APIConnectionError({
      message: "Connection error.",
      cause: new Error("The socket connection was closed unexpectedly"),
    });
    const apiErr = mapOpenAiCompatibleError(apiConn);
    expect(apiErr.code).toBe("unavailable");
    expect(apiErr.retryable).toBe(true);
  });
});
