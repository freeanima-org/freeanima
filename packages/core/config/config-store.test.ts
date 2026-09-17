import { afterEach, describe, expect, it } from "bun:test";

import type { RuntimeConfig } from "./schemas/runtime-config.ts";
import {
  bindActiveRuntimeConfig,
  Config,
  getActiveRuntimeConfig,
  resetActiveConfigForTest,
} from "./config-store.ts";

const snapshot = {
  connections: {
    main: {
      preset: "custom",
      custom_kind: "text",
      text_protocol: "openai_compatible",
      base_url: "https://api.example/v1",
    },
  },
  text_generate: { main: { connection: "main", model: "m" } },
} as RuntimeConfig;

describe("Config store", () => {
  afterEach(() => {
    resetActiveConfigForTest();
  });

  it("fromSnapshot exposes data and update replaces snapshot", () => {
    const cfg = Config.fromSnapshot(snapshot);
    expect(cfg.data.text_generate?.main?.model ?? "").toBe("m");
    cfg.update({ ...snapshot, compression: { reserved_tokens: 4096 } });
    expect(cfg.data.compression?.reserved_tokens).toBe(4096);
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
