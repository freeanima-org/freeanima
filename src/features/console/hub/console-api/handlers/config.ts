import { isBootstrapConfigKey } from "@freeanima/core/config";
import { sanitizeConfigForApi } from "@freeanima/platform/config";
import { HybridConfig, getActiveConfig, isPatchableConfig } from "@freeanima/platform/config";
import { ApiHandlerError } from "./errors.ts";
import { consoleCtx } from "./runtime.ts";

function requirePatchableConfig() {
  const config = consoleCtx().engine.config;
  if (!isPatchableConfig(config)) {
    throw new ApiHandlerError(500, "当前配置存储不支持写入", { code: "config_not_patchable" });
  }
  return config;
}

export function getHubConfig() {
  return consoleCtx().getConfig().config;
}

export function getHubConfigSection(section: string) {
  if (isBootstrapConfigKey(section)) {
    throw new ApiHandlerError(400, `段 ${section} 为 bootstrap 配置，请编辑 config.yaml`, {
      code: "config_bootstrap_section",
    });
  }
  const cfg = getHubConfig() as Record<string, unknown>;
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
    throw new ApiHandlerError(400, `段 ${section} 为 bootstrap 配置，请编辑 config.yaml`, {
      code: "config_bootstrap_section",
    });
  }
  const config = requirePatchableConfig();
  await config.patchSection(section, patch);
  return sanitizeConfigForApi(config.data);
}

export async function importHubConfigFromFile() {
  const snapshot = await HybridConfig.importRuntimeFromYamlFile();
  getActiveConfig().update(snapshot);
  return sanitizeConfigForApi(snapshot);
}
