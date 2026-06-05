import { describe, it, expect } from "bun:test";
import { createLlmRuntime } from "../../src/llm-stack.ts";
import type { NestConfig } from "@freeanima/service-config";

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
} as NestConfig;

describe("createLlmRuntime", () => {
  it("assembles backend, providers, and profiles", () => {
    const rt = createLlmRuntime(testCfg);
    expect(rt.backends.has("openai_compatible")).toBe(true);
    expect(rt.providers.has("main")).toBe(true);
    expect(rt.profiles.resolve("chat").def.id).toBe("chat");
  });
});
