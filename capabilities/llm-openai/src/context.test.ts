import { describe, expect, it } from "bun:test";
import { contextCacheKey, parseOpenAiCompatibleContext } from "./context.ts";

describe("parseOpenAiCompatibleContext", () => {
  it("accepts camelCase and snake_case and normalizes baseUrl", () => {
    const ctx = parseOpenAiCompatibleContext({
      base_url: "https://api.example.com/",
      api_key: "key",
      timeout_ms: 5000,
    });
    expect(ctx).toEqual({
      baseUrl: "https://api.example.com",
      apiKey: "key",
      timeoutMs: 5000,
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
});

describe("contextCacheKey", () => {
  it("stable key from baseUrl and apiKey", () => {
    expect(contextCacheKey({ baseUrl: "https://a.com", apiKey: "k1" })).toBe("https://a.com\0k1");
  });
});
