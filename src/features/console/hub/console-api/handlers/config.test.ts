import { afterEach, describe, expect, it } from "bun:test";

import { Config } from "@freeanima/core/config";
import type { AppRuntimeContext } from "@freeanima/platform/ports/app-runtime-context";
import { sanitizeConfigForApi } from "@freeanima/platform/config";

import { bindConsoleRuntimeContext } from "./runtime.ts";
import { getHubConfig, getHubConfigSection } from "./config.ts";

const runtimeSnapshot = {
  llm: {
    default_profile: "chat",
    providers: {
      main: {
        backend: "openai_compatible" as const,
        base_url: "https://api.example/v1",
        api_key: "sk-secret",
      },
    },
    profiles: { chat: { chain: [{ provider: "main", model: "m" }] } },
  },
};

function bindTestConsoleContext() {
  const engineConfig = Config.fromSnapshot(runtimeSnapshot);
  const ctx = {
    engine: { config: engineConfig },
    getConfig: () => ({
      config: sanitizeConfigForApi(engineConfig.data),
    }),
  } as unknown as AppRuntimeContext;
  bindConsoleRuntimeContext(() => ctx);
}

describe("hub config handlers", () => {
  afterEach(() => {
    bindConsoleRuntimeContext();
  });

  it("getHubConfig 返回已脱敏的运行时配置快照", () => {
    bindTestConsoleContext();
    const out = getHubConfig();
    const llm = out.llm as Record<string, unknown>;
    const providers = llm.providers as Record<string, Record<string, unknown>>;
    expect(providers.main?.api_key).toBe("***");
    expect(llm.default_profile).toBe("chat");
  });

  it("getHubConfigSection 按段读取配置", () => {
    bindTestConsoleContext();
    const llm = getHubConfigSection("llm") as Record<string, unknown>;
    expect(llm.default_profile).toBe("chat");
  });
});
