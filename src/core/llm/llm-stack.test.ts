import { describe, it, expect, beforeAll } from "bun:test";
import { wireOpenAiCompatibleLlm } from "@freeanima/capabilities/llm-openai";
import { createLlmRuntime } from "./llm-stack.ts";
import { registerLlmStackConfigurator } from "./llm-stack-configurator.ts";
import type { AnimaConfig } from "@freeanima/core/config";

const testCfg = {
  llm: {
    default_profile: "chat",
    providers: {
      main: {
        backend: "openai_compatible",
        base_url: "https://api.openai.com/v1",
        api_key: "test",
      },
    },
    profiles: {
      chat: {
        chain: [{ provider: "main", model: "test-model" }],
      },
    },
  },
} as AnimaConfig;

beforeAll(() => {
  registerLlmStackConfigurator(wireOpenAiCompatibleLlm);
});

describe("createLlmRuntime", () => {
  it("assembles backend, providers, and profiles", () => {
    const rt = createLlmRuntime(testCfg);
    expect(rt.backends.has("openai_compatible")).toBe(true);
    expect(rt.providers.has("main")).toBe(true);
    expect(rt.profiles.resolve("chat").def.id).toBe("chat");
  });

  it("allows missing llm for Hub cold start", () => {
    const rt = createLlmRuntime({} as AnimaConfig);
    expect(rt.backends.has("openai_compatible")).toBe(true);
    expect(rt.profiles.list()).toEqual([]);
    expect(() => rt.profiles.resolve()).toThrow(/LLM 未配置/);
  });
});
