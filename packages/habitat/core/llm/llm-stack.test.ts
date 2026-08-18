import { describe, it, expect, beforeAll } from "bun:test";
import { bindLlmStack } from "@freeanima/habitat/capabilities/llm-openai";
import { createLlmRuntime } from "./llm-stack.ts";
import { registerLlmStackConfigurator } from "./llm-stack-configurator.ts";
import type { RuntimeConfig } from "@freeanima/habitat/core/config";
import { minimalChatRuntime } from "@freeanima/habitat/core/config/test-helpers/minimal-llm-config";

const testCfg = {
  ...minimalChatRuntime({ apiKey: "test", model: "test-model" }),
} as RuntimeConfig;

beforeAll(() => {
  registerLlmStackConfigurator(bindLlmStack);
});

describe("createLlmRuntime", () => {
  it("assembles backend, providers, and profiles", () => {
    const rt = createLlmRuntime(testCfg);
    expect(rt.backends.has("openai_compatible")).toBe(true);
    expect(rt.providers.has("main")).toBe(true);
    expect(rt.profiles.resolve("chat").def.id).toBe("chat");
  });

  it("allows missing llm for Habitat cold start", () => {
    const rt = createLlmRuntime({});
    expect(rt.backends.has("openai_compatible")).toBe(true);
    expect(rt.profiles.list()).toEqual([]);
    expect(() => rt.profiles.resolve()).toThrow(/LLM 未配置/);
  });

  it("does not register image-only connections as chat providers", () => {
    const rt = createLlmRuntime({
      connections: {
        main: {
          preset: "custom",
          custom_kind: "text",
          text_protocol: "openai_compatible",
          base_url: "https://api.openai.com/v1",
          api_key: "test",
        },
        img: {
          preset: "custom",
          custom_kind: "image",
          image_protocol: "openai_images",
          base_url: "https://api.openai.com/v1",
          api_key: "test",
        },
      },
      text_generate: { main: { connection: "main", model: "test-model" } },
    });
    expect(rt.providers.has("main")).toBe(true);
    expect(rt.providers.has("img")).toBe(false);
  });

  it("degrades when text_generate.main is not text-capable", () => {
    const rt = createLlmRuntime({
      connections: {
        img: {
          preset: "custom",
          custom_kind: "image",
          image_protocol: "openai_images",
          base_url: "https://api.openai.com/v1",
          api_key: "test",
        },
      },
      text_generate: { main: { connection: "img", model: "gpt-image-1" } },
    });
    expect(rt.profiles.list()).toEqual([]);
  });
});
