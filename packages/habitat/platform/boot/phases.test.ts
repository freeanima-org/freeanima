import { describe, expect, it, mock } from "bun:test";
import { Context } from "cordis";

const calls: string[] = [];

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * 每个阶段按顺序递减的延迟：若阶段被并发执行（inject 链断裂），调用顺序会反转；
 * 只有 inject 链正确串行时才保持文档顺序。
 */
mock.module("./status.ts", () => ({
  startupLog: (message: string) => {
    calls.push(`log:${message}`);
  },
}));
mock.module("./config-phase.ts", () => ({
  bootConfigPhase: async () => {
    await sleep(70);
    calls.push("config");
    return {};
  },
}));
mock.module("./persistence-phase.ts", () => ({
  bootPersistencePhase: async () => {
    await sleep(60);
    calls.push("persistence");
    return { config: { marker: "cfg" } };
  },
}));
mock.module("./identity-phase.ts", () => ({
  bootIdentityPhase: async (config: { marker: string }) => {
    await sleep(50);
    calls.push(`identity:${config.marker}`);
    return { identity: { habitat_instance_id: "fa_inst_test" } };
  },
}));
mock.module("./world-subjects-phase.ts", () => ({
  bootWorldSubjectsPhase: async () => {
    await sleep(40);
    calls.push("world-subjects");
    return {};
  },
}));
mock.module("./config-secrets-phase.ts", () => ({
  bootConfigSecretsPhase: async () => {
    await sleep(30);
    calls.push("config-secrets");
  },
}));
mock.module("./service-api-tokens-phase.ts", () => ({
  bootServiceApiTokensPhase: async () => {
    await sleep(20);
    calls.push("service-api-tokens");
    return {};
  },
}));
mock.module("./engine-phase.ts", () => ({
  bootEnginePhase: async () => {
    await sleep(10);
    calls.push("engine");
    return {
      kernel: {},
      engine: {},
      conversation: {},
      catalog: {},
      mcp: {},
      outpost: {},
    };
  },
}));
mock.module("./runtime-phase.ts", () => ({
  bootRuntimePhase: async () => {
    await sleep(5);
    calls.push("runtime");
    return { runtime: { ok: true } };
  },
}));
mock.module("./integrations-phase.ts", () => ({
  startAsyncIntegrations: () => {},
}));

const { BOOT_PHASE_PLUGINS, BOOT_FEATURE_PLUGINS, runBootPipeline } = await import("./phases.ts");

describe("runBootPipeline", () => {
  it("mounts every phase as a Cordis plugin in dependency order", async () => {
    calls.length = 0;
    const ctx = new Context();

    await runBootPipeline(ctx, {
      statusHost: "127.0.0.1",
      port: 2658,
      onConversationUpdated: () => {},
      runtimeRef: { current: null },
      acpSessionUpdatedRef: { handler: null },
      serveOpts: {},
    });

    expect(calls.filter((c) => !c.startsWith("log:"))).toEqual([
      "config",
      "persistence",
      "identity:cfg",
      "world-subjects",
      "config-secrets",
      "service-api-tokens",
      "engine",
      "runtime",
    ]);
  });

  it("serializes phases through injects when mounted concurrently", async () => {
    calls.length = 0;
    const ctx = new Context();
    ctx.provide("bootOptions", {
      statusHost: "127.0.0.1",
      port: 2658,
      onConversationUpdated: () => {},
      runtimeRef: { current: null },
      acpSessionUpdatedRef: { handler: null },
      serveOpts: {},
    });

    await Promise.all(BOOT_PHASE_PLUGINS.map((plugin) => ctx.plugin(plugin)));
    // 让 inject 链在并发挂载后自行串行推进（pending fiber 在依赖就绪后启动）。
    await sleep(400);

    expect(calls.filter((c) => !c.startsWith("log:"))).toEqual([
      "config",
      "persistence",
      "identity:cfg",
      "world-subjects",
      "config-secrets",
      "service-api-tokens",
      "engine",
      "runtime",
    ]);
  });

  it("provides phase results on the context for downstream consumers", async () => {
    const ctx = new Context();

    await runBootPipeline(ctx, {
      statusHost: "127.0.0.1",
      port: 2658,
      onConversationUpdated: () => {},
      runtimeRef: { current: null },
      acpSessionUpdatedRef: { handler: null },
      serveOpts: {},
    });

    expect(ctx.bootPersistence.config).toBeDefined();
    expect((ctx.bootPersistence.config as unknown as { marker: string }).marker).toBe("cfg");
    expect(ctx.bootIdentity.identity.habitat_instance_id).toBe("fa_inst_test");
    expect(ctx.bootEngine).toBeDefined();
    expect((ctx.bootRuntime.runtime as unknown as { ok: boolean }).ok).toBe(true);
  });

  it("lists phases in the documented order", () => {
    expect(BOOT_PHASE_PLUGINS.map((p) => p.name)).toEqual([
      "boot-config",
      "boot-persistence",
      "boot-identity",
      "boot-world-subjects",
      "boot-config-secrets",
      "boot-service-api-tokens",
      "boot-engine",
      "boot-runtime",
    ]);
  });

  it("cordis.yml lists the same boot plugins in the same order", async () => {
    const text = await Bun.file(new URL("../../../../cordis.yml", import.meta.url)).text();
    const specs = [...text.matchAll(/^\s*-\s*name:\s*(\S+)/gm)].map((match) => match[1]!);
    const rootUrl = new URL("../../../../", import.meta.url);
    const names = await Promise.all(
      specs.map(async (spec) => {
        const mod = (await import(new URL(spec.replace(/^\.\//, ""), rootUrl).href)) as {
          default?: { name?: string };
        };
        return mod.default?.name;
      }),
    );
    expect(names).toEqual([...BOOT_PHASE_PLUGINS, ...BOOT_FEATURE_PLUGINS].map((p) => p.name));
  });
});
