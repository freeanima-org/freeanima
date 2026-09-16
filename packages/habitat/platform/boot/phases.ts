import type { Context, Plugin } from "cordis";

import { startAsyncIntegrations } from "./integrations-phase.ts";
import { startupLog } from "./status.ts";
import type { BootPipelineConfig } from "./boot-context.ts";
import configPlugin from "./plugins/config.ts";
import persistencePlugin from "./plugins/persistence.ts";
import identityPlugin from "./plugins/identity.ts";
import worldSubjectsPlugin from "./plugins/world-subjects.ts";
import configSecretsPlugin from "./plugins/config-secrets.ts";
import serviceApiTokensPlugin from "./plugins/service-api-tokens.ts";
import enginePlugin from "./plugins/engine.ts";
import runtimePlugin from "./plugins/runtime.ts";

export type { BootPipelineConfig } from "./boot-context.ts";

/**
 * Habitat 启动阶段插件清单（顺序即依赖顺序）。
 *
 * 同一份插件既由 `cordis.yml` 经 loader 挂载，也可用 `runBootPipeline`
 * 在测试/嵌入场景以编程方式挂载。
 */
export const BOOT_PHASE_PLUGINS: readonly Plugin.Object[] = [
  configPlugin,
  persistencePlugin,
  identityPlugin,
  worldSubjectsPlugin,
  configSecretsPlugin,
  serviceApiTokensPlugin,
  enginePlugin,
  runtimePlugin,
];

/** 按依赖顺序把每个启动阶段挂载为 Cordis 插件并等待完成。 */
export async function runBootPipeline(ctx: Context, pipeline: BootPipelineConfig): Promise<void> {
  ctx.provide("bootOptions", pipeline);
  for (const plugin of BOOT_PHASE_PLUGINS) {
    startupLog(`Boot plugin: ${plugin.name ?? "anonymous"}`);
    await ctx.plugin(plugin);
  }
}

export type BootIntegrationsContext = Parameters<typeof startAsyncIntegrations>[0];

export type BootConfig = import("@freeanima/habitat/platform/config").RuntimeConfigStore;

export { startAsyncIntegrations };

export type { ServeOptions } from "./types.ts";
