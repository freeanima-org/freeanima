import { afterEach, describe, expect, it } from "bun:test";

import type { AnimaConfig } from "./schemas/config.ts";
import {
  bindActiveRuntimeConfig,
  Config,
  getActiveRuntimeConfig,
  resetActiveConfigForTest,
} from "./config-store.ts";

const snapshot = {
  llm: {
    default_profile: "chat",
    providers: {
      main: { backend: "openai_compatible" as const, base_url: "https://api.example/v1" },
    },
    profiles: { chat: { chain: [{ provider: "main", model: "m" }] } },
  },
} as AnimaConfig;

describe("Config store", () => {
  afterEach(() => {
    resetActiveConfigForTest();
  });

  it("fromSnapshot exposes data and update replaces snapshot", () => {
    const cfg = Config.fromSnapshot(snapshot);
    expect(cfg.data.llm.default_profile).toBe("chat");
    cfg.update({ ...snapshot, compression: { default_context_window: 32_000 } });
    expect(cfg.data.compression?.default_context_window).toBe(32_000);
  });

  it("bindActiveRuntimeConfig / getActiveRuntimeConfig round-trip", () => {
    const cfg = Config.fromSnapshot(snapshot);
    bindActiveRuntimeConfig(cfg);
    expect(getActiveRuntimeConfig()).toBe(cfg);
  });

  it("getActiveRuntimeConfig throws when not bound", () => {
    expect(() => getActiveRuntimeConfig()).toThrow("Active runtime config not bound");
  });
});
