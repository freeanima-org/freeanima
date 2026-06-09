import { describe, expect, it } from "bun:test";
import { OPENAI_COMPATIBLE_BACKEND_ID, parseOpenAiCompatibleProviderSpec } from "./config.ts";

describe("parseOpenAiCompatibleProviderSpec", () => {
  it("解析 yaml 配置并去掉 base_url 尾部斜杠", () => {
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

  it("无 timeout_ms 时不写入 context", () => {
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

  it("拒绝非法 backend 或缺字段", () => {
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
