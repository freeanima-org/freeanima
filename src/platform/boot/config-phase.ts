import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { wireEnginePorts } from "../wire-engine-ports.ts";
import { wireCapabilityInjection } from "../wire-capability-injection.ts";
import {
  PATHS,
  validateBootstrapOnStartup,
  validateRuntimeConfigOnStartup,
  type RuntimeConfigStore,
} from "@freeanima/platform/config";
import { bindHomeChannelConfig } from "@freeanima/platform/ports/home-channel";
import { bindActiveRuntimeConfig } from "@freeanima/core/config";

import { bindBootstrapHttpForProcess } from "../config/bootstrap-http-cache.ts";
import { loadBootstrapConfig } from "../config/bootstrap.ts";
import { claimPidFileIfUnowned, startupLog } from "./status.ts";

export type ConfigPhaseResult = Record<string, never>;

/** Phase 1: 校验 bootstrap config.yaml，注册 early mechanism ports */
export async function bootConfigPhase(): Promise<ConfigPhaseResult> {
  startupLog("Validating config.yaml (bootstrap)…");
  await validateBootstrapOnStartup();
  bindBootstrapHttpForProcess(loadBootstrapConfig().http);
  wireEnginePorts();
  wireCapabilityInjection();

  mkdirSync(dirname(PATHS.pidFile), { recursive: true });
  claimPidFileIfUnowned();

  return {};
}

/** Phase 2 之后：绑定 RuntimeConfig 并校验 */
export function bindRuntimeConfig(config: RuntimeConfigStore): void {
  bindActiveRuntimeConfig(config);
  bindHomeChannelConfig(config);
  validateRuntimeConfigOnStartup(config.data);
}

export { bindHomeChannelConfig };
