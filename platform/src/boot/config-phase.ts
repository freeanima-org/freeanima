import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { wireEnginePorts } from "../wire-engine-ports.ts";
import { wireCapabilityInjection } from "../wire-capability-injection.ts";
import { wireEmbeddingRuntime } from "../runtime/embedding-wire.ts";
import { wireTokenizerRuntime } from "../runtime/tokenizer-wire.ts";
import {
  FileConfig,
  PATHS,
  resolveLlmProviderApiKeys,
  validateConfigOnStartup,
} from "@freeanima/platform/config";
import { bindHomeChannelConfig } from "@freeanima/platform/ports/home-channel";

import { startupLog } from "./status.ts";

export type ConfigPhaseResult = {
  config: ReturnType<typeof FileConfig.open>;
};

/** Phase 1: 校验并打开 config，注册 early mechanism ports */
export async function bootConfigPhase(): Promise<ConfigPhaseResult> {
  startupLog("Validating config.yaml…");
  await validateConfigOnStartup();
  const config = FileConfig.open();
  config.update(await resolveLlmProviderApiKeys(config.data));
  bindHomeChannelConfig(config);

  wireEnginePorts();
  wireCapabilityInjection();
  wireEmbeddingRuntime(config);
  await wireTokenizerRuntime(config);

  mkdirSync(dirname(PATHS.pidFile), { recursive: true });
  writeFileSync(PATHS.pidFile, String(process.pid));

  return { config };
}
