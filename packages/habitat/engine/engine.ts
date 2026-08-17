import type { EngineCatalog } from "./catalog.ts";
import { createEngineCatalog } from "./catalog.ts";
import type { Config } from "@freeanima/habitat/core/config";
import {
  bindActiveRuntimeConfig,
  registerRuntimeLogger,
  resetActiveConfigForTest,
  resetRuntimeLoggerForTest,
} from "@freeanima/habitat/core/config";
import { createLlmRuntime, type LlmRuntime } from "@freeanima/habitat/core/llm";
import type { Logger } from "@freeanima/habitat/kernel/logging";
import { createLogger } from "@freeanima/habitat/kernel/logging";
import { createNullSink } from "@freeanima/habitat/kernel/logging/sinks/null.ts";

export type { EngineCatalog } from "./catalog.ts";
export { createEngineCatalog } from "./catalog.ts";

/** LLM sub-component group（与 llm-stack LlmRuntime 同形，含 resolveProfileId） */
export type EngineLlm = LlmRuntime;

export type EngineDeps = {
  catalog?: EngineCatalog;
  llm?: EngineLlm;
  config: Config;
  logger?: Logger;
};

function defaultLlm(config: Config): EngineLlm {
  return createLlmRuntime(config.data);
}

function defaultLogger(): Logger {
  return createLogger({ level: "error", sinks: [createNullSink()] });
}

/** Construct Engine; binds active Config and logger for mechanism layers */
export function createEngine(deps: EngineDeps): Engine {
  const logger = deps.logger ?? defaultLogger();
  bindActiveRuntimeConfig(deps.config);
  registerRuntimeLogger(logger);
  return new Engine(
    deps.catalog ?? createEngineCatalog(),
    deps.llm ?? defaultLlm(deps.config),
    deps.config,
    logger,
  );
}

/** Reset runtime bindings (unit tests) */
export function resetEngineRuntimeForTests(): void {
  resetActiveConfigForTest();
  resetRuntimeLoggerForTest();
}

/** Engine-layer composition view */
export class Engine {
  constructor(
    readonly catalog: EngineCatalog,
    /** 可被 runtime config 热 apply 替换（initLlmRuntime 后写回） */
    public llm: EngineLlm,
    readonly config: Config,
    readonly logger: Logger,
  ) {}

  get toolSets() {
    return this.catalog.toolSets;
  }

  get skills() {
    return this.catalog.skills;
  }
}
