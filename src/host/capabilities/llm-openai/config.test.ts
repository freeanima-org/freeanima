import { describe, expect, it } from "bun:test";
import { OPENAI_COMPATIBLE_BACKEND_ID, parseOpenAiCompatibleProviderSpec } from "./config.ts";

describe("parseOpenAiCompatibleProviderSpec", () => {
  it("parses yaml config and strips trailing slash from base_url", () => {
    const spec = parseOpenAiCompatibleProviderSpec("deepseek", {
      backend: OPENAI_COMPATIBLE_BACKEND_ID,
      base_url: "https://api.example.com/v1/",
      api_key: "sk-test",
      timeout_ms: 30_000,
    });
    expect(spec).toEqual({
      id: "deepseek",
      backendId: OPENAI_COMPATIBLE_BACKEND_ID,
      context: {
        baseUrl: "https://api.example.com/v1",
        apiKey: "sk-test",
        timeoutMs: 30_000,
      },
    });
  });

  it("does not write context when no timeout_ms", () => {
    const spec = parseOpenAiCompatibleProviderSpec("p", {
      backend: OPENAI_COMPATIBLE_BACKEND_ID,
      base_url: "https://api.example.com",
      api_key: "k",
    });
    expect(spec.context).toEqual({
      baseUrl: "https://api.example.com",
      apiKey: "k",
    });
  });

  it("parses first_byte and idle timeouts", () => {
    const spec = parseOpenAiCompatibleProviderSpec("p", {
      backend: OPENAI_COMPATIBLE_BACKEND_ID,
      base_url: "https://api.example.com",
      api_key: "k",
      timeout_ms: 120_000,
      first_byte_timeout_ms: 20_000,
      idle_timeout_ms: 60_000,
    });
    expect(spec.context).toMatchObject({
      timeoutMs: 120_000,
      firstByteTimeoutMs: 20_000,
      idleTimeoutMs: 60_000,
    });
  });

  it("rejects first_byte_timeout_ms > timeout_ms", () => {
    expect(() =>
      parseOpenAiCompatibleProviderSpec("p", {
        backend: OPENAI_COMPATIBLE_BACKEND_ID,
        base_url: "https://api.example.com",
        api_key: "k",
        timeout_ms: 10_000,
        first_byte_timeout_ms: 20_000,
      }),
    ).toThrow();
  });

  it("rejects invalid backend or missing fields", () => {
    expect(() =>
      parseOpenAiCompatibleProviderSpec("p", {
        backend: "other",
        base_url: "https://x.com",
        api_key: "k",
      }),
    ).toThrow();
    expect(() =>
      parseOpenAiCompatibleProviderSpec("p", {
        backend: OPENAI_COMPATIBLE_BACKEND_ID,
        base_url: "not-a-url",
        api_key: "k",
      }),
    ).toThrow();
  });
});
