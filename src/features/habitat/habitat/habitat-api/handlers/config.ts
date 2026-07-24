import { isBootstrapConfigKey, isRuntimeConfigSectionKey } from "@freeanima/host/core/config";
import {
  sanitizeConfigForApi,
  isPatchableRuntimeConfig,
  restoreMaskedSecrets,
} from "@freeanima/host/platform/config";
import { ApiHandlerError } from "./errors.ts";
import { habitatCtx } from "./runtime.ts";

function requirePatchableConfig() {
  const config = habitatCtx().engine.config;
  if (!isPatchableRuntimeConfig(config)) {
    throw new ApiHandlerError(500, "当前配置存储不支持写入", { code: "config_not_patchable" });
  }
  return config;
}

export function getHabitatConfig() {
  // SafeConfigSnapshot.config 已是脱敏后的运行时配置快照，无嵌套 .data 字段。
  return habitatCtx().getConfig().config;
}

export function getHabitatConfigSection(section: string) {
  if (isBootstrapConfigKey(section)) {
    throw new ApiHandlerError(400, `段 ${section} 为平台冷启动配置，非栖息地运行时配置`, {
      code: "config_bootstrap_section",
    });
  }
  const cfg = habitatCtx().getConfig().config;
  const value = cfg[section];
  if (value !== undefined) {
    return value;
  }
  // 已知可选段从未写入 PG → 空对象（与旧全量 get + ?? {} 一致）
  if (isRuntimeConfigSectionKey(section)) {
    return {};
  }
  throw new ApiHandlerError(404, `配置段不存在: ${section}`, {
    code: "config_section_not_found",
    params: { section },
  });
}

function existingSection(config: { data: Record<string, unknown> }, section: string): unknown {
  return (config.data as Record<string, unknown>)[section];
}

export async function patchHabitatConfigSection(section: string, patch: Record<string, unknown>) {
  if (isBootstrapConfigKey(section)) {
    throw new ApiHandlerError(400, `段 ${section} 为平台冷启动配置，非栖息地运行时配置`, {
      code: "config_bootstrap_section",
    });
  }
  const config = requirePatchableConfig();
  const restored = restoreMaskedSecrets(patch, existingSection(config, section));
  await config.patchSection(section, restored);
  return sanitizeConfigForApi(config.data as import("@freeanima/host/core/config").RuntimeConfig);
}

export async function replaceHabitatConfigSection(section: string, value: Record<string, unknown>) {
  if (isBootstrapConfigKey(section)) {
    throw new ApiHandlerError(400, `段 ${section} 为平台冷启动配置，非栖息地运行时配置`, {
      code: "config_bootstrap_section",
    });
  }
  const config = requirePatchableConfig();
  const restored = restoreMaskedSecrets(value, existingSection(config, section));
  await config.replaceSection(section, restored);
  return sanitizeConfigForApi(config.data as import("@freeanima/host/core/config").RuntimeConfig);
}
