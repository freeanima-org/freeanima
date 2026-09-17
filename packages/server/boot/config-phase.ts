import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { bindEnginePorts } from "../bind-engine-ports.ts";
import { bindCapabilityInjection } from "../bind-capability-injection.ts";
import {
  PATHS,
  validateBootstrapOnStartup,
  validateRuntimeConfigOnStartup,
  type RuntimeConfigStore,
} from "@freeanima/server/config";
import { bindHomeChannelConfig } from "@freeanima/capabilities/ports/home-channel";
import { platformPorts } from "@freeanima/capabilities/ports/service.ts";
import { patchRuntimeConfigSection } from "@freeanima/server/config";
import { bindActiveRuntimeConfig } from "@freeanima/core/config";

import { claimPidFileIfUnowned, startupLog } from "./status.ts";

export type ConfigPhaseResult = Record<string, never>;

/** Phase 1: 校验 bootstrap config.yaml，注册 early mechanism ports */
export async function bootConfigPhase(): Promise<ConfigPhaseResult> {
  startupLog("Validating config.yaml (bootstrap)…");
  await validateBootstrapOnStartup();
  bindEnginePorts();
  bindCapabilityInjection();

  mkdirSync(dirname(PATHS.pidFile), { recursive: true });
  claimPidFileIfUnowned();

  return {};
}

/** Phase 2 之后：绑定 RuntimeConfig 并校验 */
export function bindRuntimeConfig(config: RuntimeConfigStore): void {
  bindActiveRuntimeConfig(config);
  bindHomeChannelConfig(config);
  // 端口层不 import 组合根：运行时配置写入由此处注入
  platformPorts().patchRuntimeConfigSection = (section, patch) =>
    patchRuntimeConfigSection(section, patch);
  validateRuntimeConfigOnStartup(config.data);
}

export { bindHomeChannelConfig };
