import { afterEach, describe, expect, it, mock } from "bun:test";

import { Config, type RuntimeConfig } from "@freeanima/habitat/core/config";
import type { AppRuntimeContext } from "@freeanima/habitat/platform/ports/app-runtime-context";
import { sanitizeConfigForApi } from "@freeanima/habitat/platform/config";

import { bindHabitatRuntimeContext } from "./runtime.ts";
import { ApiHandlerError } from "./errors.ts";
import { getHabitatConfig, getHabitatConfigSection } from "./config.ts";

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

function bindPatchableConsoleContext(opts?: {
  onReload?: () => void;
  afterReload?: RuntimeConfig;
}) {
  const engineConfig = Config.fromSnapshot(runtimeSnapshot);
  const reload = mock(async () => {
    opts?.onReload?.();
    if (opts?.afterReload) {
      engineConfig.update(opts.afterReload);
      return opts.afterReload;
    }
    return engineConfig.data;
  });
  Object.assign(engineConfig, {
    patchSection: mock(async () => engineConfig.data),
    replaceSection: mock(async () => engineConfig.data),
    reload,
  });
  const ctx = {
    engine: { config: engineConfig },
    getConfig: () => ({
      config: sanitizeConfigForApi(engineConfig.data),
    }),
  } as unknown as AppRuntimeContext;
  bindHabitatRuntimeContext(() => ctx);
  return { reload, engineConfig };
}

describe("habitat config handlers", () => {
  afterEach(() => {
    bindHabitatRuntimeContext();
  });

  it("getHabitatConfig 返回含密钥明文的运行时配置快照", async () => {
    bindTestConsoleContext();
    const out = await getHabitatConfig();
    const llm = out.llm as Record<string, unknown>;
    const providers = llm.providers as Record<string, Record<string, unknown>>;
    expect(providers.main?.api_key).toBe("sk-secret");
    expect(llm.default_profile).toBe("chat");
  });

  it("getHabitatConfigSection 按段读取配置", async () => {
    bindTestConsoleContext();
    const llm = (await getHabitatConfigSection("llm")) as Record<string, unknown>;
    expect(llm.default_profile).toBe("chat");
  });

  it("getHabitatConfigSection 对未写入的已知段返回空对象", async () => {
    bindTestConsoleContext();
    expect(await getHabitatConfigSection("gateway")).toEqual({});
    expect(await getHabitatConfigSection("tts")).toEqual({});
  });

  it("getHabitatConfigSection 拒绝 bootstrap 段", async () => {
    bindTestConsoleContext();
    try {
      await getHabitatConfigSection("database");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiHandlerError);
      expect((e as ApiHandlerError).status).toBe(400);
      expect((e as ApiHandlerError).context?.code).toBe("config_bootstrap_section");
    }
  });

  it("getHabitatConfigSection 对未知段返回 404", async () => {
    bindTestConsoleContext();
    try {
      await getHabitatConfigSection("no_such_section");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiHandlerError);
      expect((e as ApiHandlerError).status).toBe(404);
      expect((e as ApiHandlerError).context?.code).toBe("config_section_not_found");
    }
  });

  it("patchable 时 getSection 先 reload 再返回刷新后的段", async () => {
    const { reload } = bindPatchableConsoleContext({
      afterReload: {
        ...runtimeSnapshot,
        llm: {
          ...runtimeSnapshot.llm,
          default_profile: "reflect",
        },
      },
    });
    const llm = (await getHabitatConfigSection("llm")) as Record<string, unknown>;
    expect(reload).toHaveBeenCalledTimes(1);
    expect(llm.default_profile).toBe("reflect");
  });

  it("patchable 时 get 会 reload", async () => {
    const { reload } = bindPatchableConsoleContext();
    await getHabitatConfig();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
