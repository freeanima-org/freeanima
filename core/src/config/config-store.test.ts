import { afterEach, describe, expect, it } from "bun:test";

import type { AnimaConfig } from "./schemas/config.ts";
import {
  bindActiveConfig,
  Config,
  getActiveConfig,
  resetActiveConfigForTest,
} from "./config-store.ts";
import { MINIMAL_REMOTE_AUTH } from "./test-helpers/minimal-llm-config.ts";

const snapshot = {
  llm: {
    default_profile: "chat",
    providers: {
      main: { backend: "openai_compatible" as const, base_url: "https://api.example/v1" },
    },
    profiles: { chat: { chain: [{ provider: "main", model: "m" }] } },
  },
  remote_auth: MINIMAL_REMOTE_AUTH,
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

  it("bindActiveConfig / getActiveConfig round-trip", () => {
    const cfg = Config.fromSnapshot(snapshot);
    bindActiveConfig(cfg);
    expect(getActiveConfig()).toBe(cfg);
  });

  it("getActiveConfig throws when not bound", () => {
    expect(() => getActiveConfig()).toThrow("Active Config not bound");
  });
});
