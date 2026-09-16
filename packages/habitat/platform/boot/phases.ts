import type { Context, Plugin } from "cordis";

import { builtinFeaturePlugins } from "../features/builtin-feature-plugins.ts";
import { mountFeatureService } from "../features/service.ts";
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

/**
 * Feature 插件清单：每个 Habitat route bundle 一个 Cordis 插件，由 loader
 * 在启动阶段之后挂载（各自 inject `features`，便于按 feature 挂载/热更新）。
 */
export const BOOT_FEATURE_PLUGINS: readonly Plugin.Object[] = builtinFeaturePlugins;

/** 按依赖顺序把每个启动阶段与 feature 插件挂载为 Cordis 插件并等待完成。 */
export async function runBootPipeline(ctx: Context, pipeline: BootPipelineConfig): Promise<void> {
  ctx.provide("bootOptions", pipeline);
  mountFeatureService(ctx);
  for (const plugin of [...BOOT_PHASE_PLUGINS, ...BOOT_FEATURE_PLUGINS]) {
    startupLog(`Boot plugin: ${plugin.name ?? "anonymous"}`);
    await ctx.plugin(plugin);
  }
}

export type BootIntegrationsContext = Parameters<typeof startAsyncIntegrations>[0];

export type BootConfig = import("@freeanima/habitat/platform/config").RuntimeConfigStore;

export { startAsyncIntegrations };

export type { ServeOptions } from "./types.ts";
