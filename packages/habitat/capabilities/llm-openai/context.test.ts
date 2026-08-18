import { describe, expect, it } from "bun:test";
import {
  contextCacheKey,
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_FIRST_BYTE_TIMEOUT_MS,
  DEFAULT_IDLE_TIMEOUT_MS,
  DEFAULT_OVERALL_TIMEOUT_MS,
  parseOpenAiCompatibleContext,
  resolveChatTimeouts,
} from "./context.ts";

describe("parseOpenAiCompatibleContext", () => {
  it("accepts camelCase and snake_case and normalizes baseUrl", () => {
    const ctx = parseOpenAiCompatibleContext({
      base_url: "https://api.example.com/",
      api_key: "key",
      timeout_ms: 5000,
      connect_timeout_ms: 1500,
      first_byte_timeout_ms: 2000,
      idle_timeout_ms: 3000,
    });
    expect(ctx).toEqual({
      baseUrl: "https://api.example.com",
      apiKey: "key",
      timeoutMs: 5000,
      connectTimeoutMs: 1500,
      firstByteTimeoutMs: 2000,
      idleTimeoutMs: 3000,
    });
  });

  it("throws when baseUrl or apiKey missing", () => {
    expect(() => parseOpenAiCompatibleContext({ apiKey: "k" })).toThrow(/baseUrl/);
    expect(() => parseOpenAiCompatibleContext({ baseUrl: "https://x.com" })).toThrow(/apiKey/);
  });

  it("throws when timeoutMs is not positive", () => {
    expect(() =>
      parseOpenAiCompatibleContext({
        baseUrl: "https://x.com",
        apiKey: "k",
        timeoutMs: 0,
      }),
    ).toThrow(/timeoutMs/);
  });

  it("throws when connect > overall", () => {
    expect(() =>
      parseOpenAiCompatibleContext({
        baseUrl: "https://x.com",
        apiKey: "k",
        timeoutMs: 1000,
        connectTimeoutMs: 2000,
      }),
    ).toThrow(/connectTimeoutMs/);
  });

  it("throws when firstByte > overall", () => {
    expect(() =>
      parseOpenAiCompatibleContext({
        baseUrl: "https://x.com",
        apiKey: "k",
        timeoutMs: 1000,
        firstByteTimeoutMs: 2000,
      }),
    ).toThrow(/firstByteTimeoutMs/);
  });
});

describe("resolveChatTimeouts", () => {
  it("applies defaults capped by overall", () => {
    const resolved = resolveChatTimeouts({
      baseUrl: "https://x.com",
      apiKey: "k",
      timeoutMs: 5_000,
    });
    expect(resolved.overallMs).toBe(5_000);
    expect(resolved.connectMs).toBe(Math.min(DEFAULT_CONNECT_TIMEOUT_MS, 5_000));
    expect(resolved.firstByteMs).toBe(Math.min(DEFAULT_FIRST_BYTE_TIMEOUT_MS, 5_000));
    expect(resolved.idleMs).toBe(Math.min(DEFAULT_IDLE_TIMEOUT_MS, 5_000));
  });

  it("uses full defaults when timeout unset", () => {
    const resolved = resolveChatTimeouts({
      baseUrl: "https://x.com",
      apiKey: "k",
    });
    expect(resolved).toEqual({
      overallMs: DEFAULT_OVERALL_TIMEOUT_MS,
      connectMs: DEFAULT_CONNECT_TIMEOUT_MS,
      firstByteMs: DEFAULT_FIRST_BYTE_TIMEOUT_MS,
      idleMs: DEFAULT_IDLE_TIMEOUT_MS,
    });
  });
});

describe("contextCacheKey", () => {
  it("stable key from baseUrl and apiKey", () => {
    expect(contextCacheKey({ baseUrl: "https://a.com", apiKey: "k1" })).toBe("https://a.com\0k1");
  });
});
