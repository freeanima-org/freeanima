import { isBootstrapConfigKey } from "@freeanima/core/config";
import { sanitizeConfigForApi, isPatchableRuntimeConfig } from "@freeanima/platform/config";
import { ApiHandlerError } from "./errors.ts";
import { consoleCtx } from "./runtime.ts";

function requirePatchableConfig() {
  const config = consoleCtx().engine.config;
  if (!isPatchableRuntimeConfig(config)) {
    throw new ApiHandlerError(500, "当前配置存储不支持写入", { code: "config_not_patchable" });
  }
  return config;
}

export function getHubConfig() {
  // SafeConfigSnapshot.config 已是脱敏后的运行时配置快照，无嵌套 .data 字段。
  return consoleCtx().getConfig().config;
}

export function getHubConfigSection(section: string) {
  if (isBootstrapConfigKey(section)) {
    throw new ApiHandlerError(400, `段 ${section} 为平台冷启动配置，非 Hub 服务配置`, {
      code: "config_bootstrap_section",
    });
  }
  const cfg = consoleCtx().getConfig().config;
  const value = cfg[section];
  if (value === undefined) {
    throw new ApiHandlerError(404, `配置段不存在: ${section}`, {
      code: "config_section_not_found",
      params: { section },
    });
  }
  return value;
}

export async function patchHubConfigSection(section: string, patch: Record<string, unknown>) {
  if (isBootstrapConfigKey(section)) {
    throw new ApiHandlerError(400, `段 ${section} 为平台冷启动配置，非 Hub 服务配置`, {
      code: "config_bootstrap_section",
    });
  }
  const config = requirePatchableConfig();
  await config.patchSection(section, patch);
  return sanitizeConfigForApi(config.data as import("@freeanima/core/config").RuntimeConfig);
}

export async function replaceHubConfigSection(section: string, value: Record<string, unknown>) {
  if (isBootstrapConfigKey(section)) {
    throw new ApiHandlerError(400, `段 ${section} 为平台冷启动配置，非 Hub 服务配置`, {
      code: "config_bootstrap_section",
    });
  }
  const config = requirePatchableConfig();
  await config.replaceSection(section, value);
  return sanitizeConfigForApi(config.data as import("@freeanima/core/config").RuntimeConfig);
}
