import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { bindLlmStack } from "@freeanima/capabilities/llm-openai";
import { createLlmRuntime } from "@freeanima/core/llm/llm-stack.ts";
import { setLlmStackConfigurator } from "@freeanima/core/llm/llm-stack-configurator.ts";
import {
  getLlmRuntime,
  initLlmRuntime,
  resetLlmRuntimeForTests,
} from "@freeanima/core/llm/llm-stack-runtime.ts";
import { createTestContext, type TestContext } from "@freeanima/kernel/testing";
import type { RuntimeConfig } from "@freeanima/core/config";
import { minimalChatRuntime } from "@freeanima/core/config/test-helpers/minimal-llm-config";

const testCfg = {
  ...minimalChatRuntime({ apiKey: "test", model: "test-model" }),
} as RuntimeConfig;

let tc: TestContext;

beforeAll(async () => {
  // 统一 harness：根 context/logger 由 createTestContext 装配
  tc = await createTestContext();
  setLlmStackConfigurator(bindLlmStack);
});

afterAll(async () => {
  resetLlmRuntimeForTests();
  await tc.dispose();
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

describe("ctx.llmStack runtime lifecycle", () => {
  it("stores the runtime on the service and resolves it back", () => {
    const rt = initLlmRuntime(testCfg);
    expect(getLlmRuntime()).toBe(rt);
  });

  it("throws after reset until re-initialized", () => {
    initLlmRuntime(testCfg);
    resetLlmRuntimeForTests();
    expect(() => getLlmRuntime()).toThrow(/not initialized/);
  });
});
