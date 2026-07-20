import { afterEach, describe, expect, it } from "bun:test";

import { Config } from "@freeanima/core/config";
import type { AppRuntimeContext } from "@freeanima/platform/ports/app-runtime-context";
import { sanitizeConfigForApi } from "@freeanima/platform/config";

import { bindHabitatRuntimeContext } from "./runtime.ts";
import { ApiHandlerError } from "./errors.ts";
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
  bindHabitatRuntimeContext(() => ctx);
}

describe("hub config handlers", () => {
  afterEach(() => {
    bindHabitatRuntimeContext();
  });

  it("getHubConfig 返回含密钥明文的运行时配置快照", () => {
    bindTestConsoleContext();
    const out = getHubConfig();
    const llm = out.llm as Record<string, unknown>;
    const providers = llm.providers as Record<string, Record<string, unknown>>;
    expect(providers.main?.api_key).toBe("sk-secret");
    expect(llm.default_profile).toBe("chat");
  });

  it("getHubConfigSection 按段读取配置", () => {
    bindTestConsoleContext();
    const llm = getHubConfigSection("llm") as Record<string, unknown>;
    expect(llm.default_profile).toBe("chat");
  });

  it("getHubConfigSection 对未写入的已知段返回空对象", () => {
    bindTestConsoleContext();
    expect(getHubConfigSection("gateway")).toEqual({});
    expect(getHubConfigSection("tts")).toEqual({});
  });

  it("getHubConfigSection 拒绝 bootstrap 段", () => {
    bindTestConsoleContext();
    try {
      getHubConfigSection("database");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiHandlerError);
      expect((e as ApiHandlerError).status).toBe(400);
      expect((e as ApiHandlerError).context?.code).toBe("config_bootstrap_section");
    }
  });

  it("getHubConfigSection 对未知段返回 404", () => {
    bindTestConsoleContext();
    try {
      getHubConfigSection("no_such_section");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiHandlerError);
      expect((e as ApiHandlerError).status).toBe(404);
      expect((e as ApiHandlerError).context?.code).toBe("config_section_not_found");
    }
  });
});
