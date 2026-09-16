import type { Context, Plugin } from "cordis";

import type { AppRuntime } from "../service/app-runtime.ts";
import { bootConfigPhase } from "./config-phase.ts";
import { bootPersistencePhase, type PersistencePhaseResult } from "./persistence-phase.ts";
import { bootIdentityPhase, type IdentityPhaseResult } from "./identity-phase.ts";
import { bootWorldSubjectsPhase, type WorldSubjectsPhaseResult } from "./world-subjects-phase.ts";
import { bootConfigSecretsPhase } from "./config-secrets-phase.ts";
import { bootServiceApiTokensPhase } from "./service-api-tokens-phase.ts";
import { bootEnginePhase, type EnginePhaseResult } from "./engine-phase.ts";
import { bootRuntimePhase, type RuntimePhaseResult } from "./runtime-phase.ts";
import { startAsyncIntegrations } from "./integrations-phase.ts";
import { startupLog } from "./status.ts";
import type { ServeOptions } from "./types.ts";

declare module "cordis" {
  interface Context {
    bootConfig: Record<string, never>;
    bootPersistence: PersistencePhaseResult;
    bootIdentity: IdentityPhaseResult;
    bootWorldSubjects: WorldSubjectsPhaseResult;
    bootEngine: EnginePhaseResult;
    bootRuntime: RuntimePhaseResult;
  }
}

export type BootPipelineConfig = {
  statusHost: string;
  port: number;
  onConversationUpdated: (conversationId: string) => void;
  runtimeRef: { current: AppRuntime | null };
  acpSessionUpdatedRef: { handler: ((sid: string) => void) | null };
  serveOpts: ServeOptions;
};

export type BootPhasePlugin = {
  id: string;
  /** Services this phase reads; gates activation and allows `ctx.<name>` access. */
  inject?: string[];
  apply: (ctx: Context, pipeline: BootPipelineConfig) => void | Promise<void>;
};

/**
 * Habitat 启动阶段清单（顺序即依赖顺序）。
 *
 * 每个阶段是一个 Cordis 插件：读取上游阶段 `ctx.boot*` 服务、把结果
 * `ctx.provide` 回根上下文，后续阶段与 `serve()` 都从 ctx 取用。
 */
export const BOOT_PHASE_PLUGINS: readonly BootPhasePlugin[] = [
  {
    id: "config",
    apply: async (ctx) => {
      await bootConfigPhase();
      ctx.provide("bootConfig", {});
    },
  },
  {
    id: "persistence",
    apply: async (ctx) => {
      ctx.provide("bootPersistence", await bootPersistencePhase());
    },
  },
  {
    id: "identity",
    inject: ["bootPersistence"],
    apply: async (ctx) => {
      ctx.provide("bootIdentity", await bootIdentityPhase(ctx.bootPersistence.config));
    },
  },
  {
    id: "world-subjects",
    inject: ["bootPersistence"],
    apply: async (ctx) => {
      ctx.provide("bootWorldSubjects", await bootWorldSubjectsPhase(ctx.bootPersistence.config));
    },
  },
  {
    id: "config-secrets",
    inject: ["bootPersistence"],
    apply: async (ctx) => {
      await bootConfigSecretsPhase(ctx.bootPersistence.config);
    },
  },
  {
    id: "service-api-tokens",
    inject: ["bootPersistence"],
    apply: async (ctx) => {
      await bootServiceApiTokensPhase(ctx.bootPersistence.config);
    },
  },
  {
    id: "engine",
    inject: ["bootPersistence"],
    apply: async (ctx, pipeline) => {
      ctx.provide(
        "bootEngine",
        await bootEnginePhase(ctx.bootPersistence.config, pipeline.onConversationUpdated),
      );
    },
  },
  {
    id: "runtime",
    inject: ["bootEngine"],
    apply: async (ctx, pipeline) => {
      ctx.provide(
        "bootRuntime",
        await bootRuntimePhase(
          ctx.bootEngine,
          pipeline.statusHost,
          pipeline.port,
          pipeline.runtimeRef,
          pipeline.acpSessionUpdatedRef,
        ),
      );
    },
  },
];

/** 按依赖顺序把每个启动阶段挂载为 Cordis 插件并等待完成。 */
export async function runBootPipeline(ctx: Context, pipeline: BootPipelineConfig): Promise<void> {
  for (const phase of BOOT_PHASE_PLUGINS) {
    startupLog(`Boot plugin: ${phase.id}`);
    const plugin: Plugin.Object = {
      name: phase.id,
      ...(phase.inject ? { inject: phase.inject } : {}),
      apply: (phaseCtx: Context) => phase.apply(phaseCtx, pipeline),
    };
    await ctx.plugin(plugin);
  }
}

export type BootIntegrationsContext = Parameters<typeof startAsyncIntegrations>[0];

export type BootConfig = import("@freeanima/habitat/platform/config").RuntimeConfigStore;

export { startAsyncIntegrations };

export type { ServeOptions };
