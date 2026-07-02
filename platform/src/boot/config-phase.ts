import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { wireEnginePorts } from "../wire-engine-ports.ts";
import { wireCapabilityInjection } from "../wire-capability-injection.ts";
import { FileConfig, PATHS, validateConfigOnStartup } from "@freeanima/platform/config";
import { bindHomeChannelConfig } from "@freeanima/platform/ports/home-channel";

import { startupLog } from "./status.ts";

export type ConfigPhaseResult = {
  config: ReturnType<typeof FileConfig.open>;
};

/** Phase 1: 校验并打开 config，注册 early mechanism ports（vault 解析见 config-secrets-phase） */
export async function bootConfigPhase(): Promise<ConfigPhaseResult> {
  startupLog("Validating config.yaml…");
  await validateConfigOnStartup();
  const config = FileConfig.open();
  bindHomeChannelConfig(config);

  wireEnginePorts();
  wireCapabilityInjection();

  mkdirSync(dirname(PATHS.pidFile), { recursive: true });
  writeFileSync(PATHS.pidFile, String(process.pid));

  return { config };
}
