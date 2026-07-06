import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import {
  Config,
  bindActiveConfig,
  registerCatalogContextWindowLookup,
  resetCatalogContextWindowLookupForTest,
  resetActiveConfigForTest,
} from "@freeanima/core/config";
import { buildCompressOptionsResolved } from "./compression-context.ts";

const BASE_CONFIG = {
  llm: {
    default_profile: "chat",
    providers: {
      main: {
        backend: "openai_compatible" as const,
        base_url: "https://api.openai.com/v1",
        api_key: "test",
      },
    },
    profiles: { chat: { chain: [{ provider: "main", model: "gpt-x" }] } },
  },
  compression: { enabled: true, reserved_tokens: 8192 },
  models: {},
};

describe("buildCompressOptionsResolved", () => {
  beforeEach(() => {
    bindActiveConfig(Config.fromSnapshot(BASE_CONFIG));
  });

  afterEach(() => {
    resetCatalogContextWindowLookupForTest();
    resetActiveConfigForTest();
  });

  it("uses catalog fallback when config has no window", async () => {
    registerCatalogContextWindowLookup(async () => 256_000);
    const opts = await buildCompressOptionsResolved(
      {
        role: "conversation_meta",
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
});
