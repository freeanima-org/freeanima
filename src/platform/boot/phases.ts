import type { ServeOptions } from "./types.ts";
import { bootConfigPhase } from "./config-phase.ts";
import { bootPersistencePhase } from "./persistence-phase.ts";
import { bootEnginePhase } from "./engine-phase.ts";
import { bootRuntimePhase } from "./runtime-phase.ts";
import { startAsyncIntegrations } from "./integrations-phase.ts";

/** Hub 启动阶段清单（顺序即依赖顺序） */
export const BOOT_PHASES = [
  { id: "config", run: bootConfigPhase },
  { id: "persistence", run: bootPersistencePhase },
  { id: "engine", run: bootEnginePhase },
  { id: "runtime", run: bootRuntimePhase },
] as const;

export type BootPhaseId = (typeof BOOT_PHASES)[number]["id"];

export type BootIntegrationsContext = Parameters<typeof startAsyncIntegrations>[0];

export type BootConfig = import("@freeanima/platform/config").HybridConfig;

export { startAsyncIntegrations };

export type { ServeOptions };
