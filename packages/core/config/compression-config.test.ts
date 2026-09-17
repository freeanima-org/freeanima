import { describe, expect, it } from "bun:test";
import type { RuntimeConfig } from "./schemas/runtime-config.ts";
import {
  getContextWindow,
  getEffectiveTokenBudget,
  resolveContextWindowWithSource,
} from "./compression-config.ts";

const cfg = {
  connections: {
    main: {
      preset: "custom" as const,
      custom_kind: "text" as const,
      text_protocol: "openai_compatible" as const,
      base_url: "https://api.openai.com/v1",
    },
  },
  text_generate: { main: { connection: "main", model: "m" } },
  compression: { reserved_tokens: 8192 },
} as RuntimeConfig;

describe("resolveContextWindowWithSource", () => {
  it("uses catalog window", () => {
    expect(resolveContextWindowWithSource(128_000)).toEqual({
      window: 128_000,
      source: "catalog",
    });
  });

  it("returns null when catalog missing", () => {
    expect(resolveContextWindowWithSource(null)).toEqual({ window: null, source: null });
    expect(resolveContextWindowWithSource(undefined)).toEqual({ window: null, source: null });
    expect(resolveContextWindowWithSource(0)).toEqual({ window: null, source: null });
  });
});

describe("getContextWindow", () => {
  it("returns catalog value", () => {
    expect(getContextWindow(64_000)).toBe(64_000);
  });
});

describe("getEffectiveTokenBudget", () => {
  it("subtracts reserved tokens with floor 4096", () => {
    expect(getEffectiveTokenBudget(cfg, 1_000_000)).toBe(1_000_000 - 8192);
  });

  it("returns null without catalog", () => {
    expect(getEffectiveTokenBudget(cfg, null)).toBeNull();
  });
});
