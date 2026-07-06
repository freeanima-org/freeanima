import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { wireEnginePorts } from "../wire-engine-ports.ts";
import { wireCapabilityInjection } from "../wire-capability-injection.ts";
import {
  PATHS,
  validateBootstrapOnStartup,
  validateFullConfigOnStartup,
} from "@freeanima/platform/config";
import { bindHomeChannelConfig } from "@freeanima/platform/ports/home-channel";
import type { HybridConfig } from "@freeanima/platform/config";
import { bindActiveConfig } from "@freeanima/core/config";

import { startupLog } from "./status.ts";

export type ConfigPhaseResult = Record<string, never>;

/** Phase 1: 校验 bootstrap config.yaml，注册 early mechanism ports */
export async function bootConfigPhase(): Promise<ConfigPhaseResult> {
  startupLog("Validating config.yaml (bootstrap)…");
  await validateBootstrapOnStartup();
  wireEnginePorts();
  wireCapabilityInjection();

  mkdirSync(dirname(PATHS.pidFile), { recursive: true });
  writeFileSync(PATHS.pidFile, String(process.pid));

  return {};
}

/** Phase 2 之后：绑定 HybridConfig 并校验完整配置 */
export function bindRuntimeConfig(config: HybridConfig): void {
  bindActiveConfig(config);
  bindHomeChannelConfig(config);
  validateFullConfigOnStartup(config.data);
}

export { bindHomeChannelConfig };
