import { describe, expect, it, mock } from "bun:test";
import { Context } from "cordis";

const calls: string[] = [];

mock.module("./status.ts", () => ({
  startupLog: (message: string) => {
    calls.push(`log:${message}`);
  },
}));
mock.module("./config-phase.ts", () => ({
  bootConfigPhase: async () => {
    calls.push("config");
    return {};
  },
}));
mock.module("./persistence-phase.ts", () => ({
  bootPersistencePhase: async () => {
    calls.push("persistence");
    return { config: { marker: "cfg" } };
  },
}));
mock.module("./identity-phase.ts", () => ({
  bootIdentityPhase: async (config: { marker: string }) => {
    calls.push(`identity:${config.marker}`);
    return { identity: { habitat_instance_id: "fa_inst_test" } };
  },
}));
mock.module("./world-subjects-phase.ts", () => ({
  bootWorldSubjectsPhase: async () => {
    calls.push("world-subjects");
    return {};
  },
}));
mock.module("./config-secrets-phase.ts", () => ({
  bootConfigSecretsPhase: async () => {
    calls.push("config-secrets");
  },
}));
mock.module("./service-api-tokens-phase.ts", () => ({
  bootServiceApiTokensPhase: async () => {
    calls.push("service-api-tokens");
    return {};
  },
}));
mock.module("./engine-phase.ts", () => ({
  bootEnginePhase: async () => {
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
    calls.push("runtime");
    return { runtime: { ok: true } };
  },
}));
mock.module("./integrations-phase.ts", () => ({
  startAsyncIntegrations: () => {},
}));

const { BOOT_PHASE_PLUGINS, runBootPipeline } = await import("./phases.ts");

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
    expect(names).toEqual(BOOT_PHASE_PLUGINS.map((p) => p.name));
  });
});
