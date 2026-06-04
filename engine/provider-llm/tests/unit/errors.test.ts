import { describe, expect, it } from "bun:test";
import {
  ProviderError,
  classifyProviderError,
  isProviderError,
  providerErrorFromHttpStatus,
} from "../../src/errors";

describe("ProviderError", () => {
  it("exposes providerId from options", () => {
    const err = new ProviderError("x", "authentication", false, { providerId: "main" });
    expect(err.name).toBe("ProviderError");
    expect(err.providerId).toBe("main");
    expect(err.retryable).toBe(false);
  });
});

describe("classifyProviderError", () => {
  it("classifies retryable ProviderError", () => {
    expect(classifyProviderError(new ProviderError("x", "rate_limited", true))).toBe("retryable");
  });

  it("treats unknown errors as fatal", () => {
    expect(classifyProviderError(new Error("boom"))).toBe("fatal");
  });
});

describe("isProviderError", () => {
  it("narrows ProviderError instances", () => {
    const err = new ProviderError("x", "unknown", false);
    expect(isProviderError(err)).toBe(true);
    expect(isProviderError(new Error("x"))).toBe(false);
  });
});

describe("providerErrorFromHttpStatus", () => {
  const cases: Array<[number, ProviderError["code"], boolean]> = [
    [429, "rate_limited", true],
    [401, "authentication", false],
    [403, "authentication", false],
    [404, "model_not_found", false],
    [408, "timeout", true],
    [502, "unavailable", true],
    [503, "unavailable", true],
    [504, "unavailable", true],
    [400, "invalid_request", false],
    [418, "invalid_request", false],
    [500, "unavailable", true],
    [200, "unknown", false],
  ];

  for (const [status, code, retryable] of cases) {
    it(`maps HTTP ${status} → ${code} (retryable=${retryable})`, () => {
      const err = providerErrorFromHttpStatus(status, "msg", { providerId: "p1" });
      expect(err.code).toBe(code);
      expect(err.retryable).toBe(retryable);
      expect(err.providerId).toBe("p1");
    });
  }
});
