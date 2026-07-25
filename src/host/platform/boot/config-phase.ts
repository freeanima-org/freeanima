import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { bindEnginePorts } from "../bind-engine-ports.ts";
import { bindCapabilityInjection } from "../bind-capability-injection.ts";
import {
  PATHS,
  validateBootstrapOnStartup,
  validateRuntimeConfigOnStartup,
  type RuntimeConfigStore,
} from "@freeanima/host/platform/config";
import { bindHomeChannelConfig } from "@freeanima/host/platform/ports/home-channel";
import { bindActiveRuntimeConfig } from "@freeanima/host/core/config";

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
  validateRuntimeConfigOnStartup(config.data);
}

export { bindHomeChannelConfig };
