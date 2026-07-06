import { describe, expect, it } from "bun:test";
import type { AnimaConfig } from "./schemas/config.ts";
import {
  getContextWindow,
  getEffectiveTokenBudget,
  resolveContextWindowWithSource,
} from "./compression-config.ts";

const cfg = {
  llm: {
    default_profile: "chat",
    providers: {
      main: {
        backend: "openai_compatible" as const,
        base_url: "https://api.openai.com/v1",
      },
    },
    profiles: { chat: { chain: [{ provider: "main", model: "m" }] } },
  },
  compression: { default_context_window: 256_000, reserved_tokens: 8192 },
  models: {
    "deepseek-v4-flash": { context_window: 1_000_000 },
  },
} as AnimaConfig;

describe("resolveContextWindowWithSource", () => {
  it("prefers per-model config", () => {
    const r = resolveContextWindowWithSource(cfg, "deepseek-v4-flash");
    expect(r).toEqual({ window: 1_000_000, source: "config" });
  });

  it("falls back to compression.default_context_window", () => {
    const r = resolveContextWindowWithSource(cfg, "unknown-model");
    expect(r).toEqual({ window: 256_000, source: "default" });
  });

  it("falls back to catalog when config tiers unset", () => {
    const bare = { models: {} } as AnimaConfig;
    const r = resolveContextWindowWithSource(bare, "gpt-4", { catalogFallback: 128_000 });
    expect(r).toEqual({ window: 128_000, source: "catalog" });
  });

  it("returns null when no source available", () => {
    const r = resolveContextWindowWithSource({} as AnimaConfig, "gpt-4");
    expect(r).toEqual({ window: null, source: null });
  });
});

describe("getContextWindow catalog fallback", () => {
  it("uses catalogFallback after config tiers", () => {
    const bare = { models: {} } as AnimaConfig;
    expect(getContextWindow(bare, "m", { catalogFallback: 64_000 })).toBe(64_000);
  });
});

describe("getEffectiveTokenBudget", () => {
  it("subtracts reserved tokens with floor 4096", () => {
    expect(getEffectiveTokenBudget(cfg, "deepseek-v4-flash")).toBe(1_000_000 - 8192);
  });

  it("honors catalog fallback", () => {
    const bare = { compression: { reserved_tokens: 8192 } } as AnimaConfig;
    expect(getEffectiveTokenBudget(bare, "m", { catalogFallback: 20_000 })).toBe(20_000 - 8192);
  });
});
