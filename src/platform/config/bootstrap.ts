import {
  bootstrapConfigSchema,
  hasRuntimeSectionsInYaml,
  pickBootstrapRecord,
  type BootstrapConfig,
} from "@freeanima/core/config";
import { loadConfigYamlRecord } from "./yaml-io.ts";

/** 读取并校验 config.yaml bootstrap 段（platform 内部） */
export function loadBootstrapConfig(): BootstrapConfig {
  const yamlRecord = loadConfigYamlRecord();
  if (hasRuntimeSectionsInYaml(yamlRecord)) {
    console.warn(
      "[config] config.yaml 仍含运行时配置段，已忽略；请在 Shell Habitat 服务设置中编辑，并清理 YAML 废段",
    );
  }
  const bootstrap = pickBootstrapRecord(yamlRecord);
  return bootstrapConfigSchema.parse(bootstrap);
}
