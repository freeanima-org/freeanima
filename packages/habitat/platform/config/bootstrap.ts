import { existsSync, readFileSync } from "node:fs";

import {
  bootstrapConfigSchema,
  hasRuntimeSectionsInYaml,
  pickBootstrapRecord,
  type BootstrapConfig,
} from "@freeanima/habitat/core/config";

import { asRecord } from "@freeanima/shared/util";

import { formatBootstrapConfigError, formatMissingConfigYamlError } from "./bootstrap-error.ts";
import { expandConfigEnv } from "./env-expand.ts";
import { PATHS } from "./paths.ts";
import { parseYaml } from "./yaml.ts";

export type LoadedBootstrapConfig = {
  config: BootstrapConfig;
  record: Record<string, unknown>;
};

/** 读取并校验 config.yaml bootstrap 段；失败抛可读 Error（非原始 ZodError） */
export function readBootstrapConfig(): LoadedBootstrapConfig {
  if (!existsSync(PATHS.configYaml)) {
    throw new Error(formatMissingConfigYamlError(PATHS.configYaml));
  }

  let yamlRecord: Record<string, unknown>;
  try {
    const raw = expandConfigEnv(readFileSync(PATHS.configYaml, "utf-8"));
    yamlRecord = asRecord(parseYaml(raw)) ?? {};
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`config.yaml 解析失败（${PATHS.configYaml}）：${msg}`, { cause: err });
  }

  if (hasRuntimeSectionsInYaml(yamlRecord)) {
    console.warn(
      "[config] config.yaml 仍含运行时配置段，已忽略；请在 Shell Habitat 服务设置中编辑，并清理 YAML 废段",
    );
  }

  const bootstrap = pickBootstrapRecord(yamlRecord);
  const parsed = bootstrapConfigSchema.safeParse(bootstrap);
  if (!parsed.success) {
    throw new Error(formatBootstrapConfigError(parsed.error, PATHS.configYaml));
  }

  return { config: parsed.data, record: yamlRecord };
}

/** 读取并校验 config.yaml bootstrap 段（platform 内部） */
export function loadBootstrapConfig(): BootstrapConfig {
  return readBootstrapConfig().config;
}
