import { describe, expect, it } from "bun:test";
import { LLM_FORMAT_OPENAI_COMPATIBLE } from "@freeanima/habitat/core/config/schemas/llm-config.ts";
import { parseOpenAiCompatibleProviderSpec } from "./config.ts";

const customText = {
  preset: "custom" as const,
  custom_kind: "text" as const,
  text_protocol: LLM_FORMAT_OPENAI_COMPATIBLE,
};

describe("parseOpenAiCompatibleProviderSpec", () => {
  it("parses yaml config and strips trailing slash from base_url", () => {
    const spec = parseOpenAiCompatibleProviderSpec("deepseek", {
      ...customText,
      base_url: "https://api.example.com/v1/",
      api_key: "sk-test",
      timeout_ms: 30_000,
    });
    expect(spec).toEqual({
      id: "deepseek",
      backendId: LLM_FORMAT_OPENAI_COMPATIBLE,
      context: {
        baseUrl: "https://api.example.com/v1",
        apiKey: "sk-test",
        timeoutMs: 30_000,
      },
    });
  });

  it("does not write context when no timeout_ms", () => {
    const spec = parseOpenAiCompatibleProviderSpec("p", {
      ...customText,
      base_url: "https://api.example.com",
      api_key: "k",
    });
    expect(spec.context).toEqual({
      baseUrl: "https://api.example.com",
      apiKey: "k",
    });
  });

  it("parses first_byte, idle, and connect timeouts", () => {
    const spec = parseOpenAiCompatibleProviderSpec("p", {
      ...customText,
      base_url: "https://api.example.com",
      api_key: "k",
      timeout_ms: 120_000,
      connect_timeout_ms: 8_000,
      first_byte_timeout_ms: 20_000,
      idle_timeout_ms: 60_000,
    });
    expect(spec.context).toMatchObject({
      timeoutMs: 120_000,
      connectTimeoutMs: 8_000,
      firstByteTimeoutMs: 20_000,
      idleTimeoutMs: 60_000,
    });
  });

  it("rejects connect_timeout_ms > timeout_ms", () => {
    expect(() =>
      parseOpenAiCompatibleProviderSpec("p", {
        ...customText,
        base_url: "https://api.example.com",
        api_key: "k",
        timeout_ms: 10_000,
        connect_timeout_ms: 20_000,
      }),
    ).toThrow();
  });

  it("rejects first_byte_timeout_ms > timeout_ms", () => {
    expect(() =>
      parseOpenAiCompatibleProviderSpec("p", {
        ...customText,
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
        preset: "custom",
        custom_kind: "text",
        text_protocol: "other",
        base_url: "https://x.com",
        api_key: "k",
      }),
    ).toThrow();
    expect(() =>
      parseOpenAiCompatibleProviderSpec("p", {
        ...customText,
        base_url: "not-a-url",
        api_key: "k",
      }),
    ).toThrow();
  });
});
