import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import {
  Config,
  bindActiveRuntimeConfig,
  registerCatalogContextWindowLookup,
  resetCatalogContextWindowLookupForTest,
  resetActiveConfigForTest,
} from "@freeanima/habitat/core/config";
import { buildCompressOptionsResolved } from "./compression-context.ts";

const BASE_CONFIG = {
  connections: {
    main: {
      preset: "custom" as const,
      custom_kind: "text" as const,
      text_protocol: "openai_compatible" as const,
      base_url: "https://api.openai.com/v1",
      api_key: "test",
    },
  },
  text_generate: { main: { connection: "main", model: "gpt-x" } },
  compression: { enabled: true, reserved_tokens: 8192 },
};

describe("buildCompressOptionsResolved", () => {
  beforeEach(() => {
    bindActiveRuntimeConfig(Config.fromSnapshot(BASE_CONFIG));
  });

  afterEach(() => {
    resetCatalogContextWindowLookupForTest();
    resetActiveConfigForTest();
  });

  it("uses Provider catalog context window", async () => {
    registerCatalogContextWindowLookup(async () => 256_000);
    const opts = await buildCompressOptionsResolved(
      {
        model: "gpt-x",
        cached_toolsets: [],
        functions: [],
        timestamp: new Date().toISOString(),
      },
      null,
      "gpt-x",
    );
    expect(opts.contextWindowSource).toBe("catalog");
    expect(opts.contextWindow).toBe(256_000);
    expect(opts.effectiveBudgetOverride).toBe(256_000 - 8192);
  });

  it("ignores meta.model and uses fallbackModel for budget", async () => {
    registerCatalogContextWindowLookup(async (model) => (model === "hop-model" ? 100_000 : 1));
    const opts = await buildCompressOptionsResolved(
      {
        model: "stale-meta-model",
        cached_toolsets: [],
        functions: [],
        timestamp: new Date().toISOString(),
        system_prompt: "sys",
      },
      null,
      "hop-model",
    );
    expect(opts.model).toBe("hop-model");
    expect(opts.systemPrompt).toBe("sys");
    expect(opts.contextWindow).toBe(100_000);
  });
});
