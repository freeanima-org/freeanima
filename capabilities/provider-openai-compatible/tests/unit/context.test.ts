import { describe, expect, it } from "bun:test";
import { contextCacheKey, parseOpenAiCompatibleContext } from "../../src/context";

describe("parseOpenAiCompatibleContext", () => {
  it("接受 camelCase 与 snake_case 并规范化 baseUrl", () => {
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

  it("缺少 baseUrl 或 apiKey 时抛错", () => {
    expect(() => parseOpenAiCompatibleContext({ apiKey: "k" })).toThrow(/baseUrl/);
    expect(() => parseOpenAiCompatibleContext({ baseUrl: "https://x.com" })).toThrow(/apiKey/);
  });

  it("timeoutMs 非正数时抛错", () => {
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
  it("由 baseUrl 与 apiKey 组成稳定键", () => {
    expect(contextCacheKey({ baseUrl: "https://a.com", apiKey: "k1" })).toBe("https://a.com\0k1");
  });
});
