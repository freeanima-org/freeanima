import type { EngineCatalog } from "./catalog.ts";
import { createEngineCatalog } from "./catalog.ts";
import type {
  BackendRegistry,
  ProfileRegistry,
  ProviderRegistry,
} from "@freeanima/host/core/provider";
import type { Config } from "@freeanima/host/core/config";
import {
  bindActiveRuntimeConfig,
  registerRuntimeLogger,
  resetActiveConfigForTest,
  resetRuntimeLoggerForTest,
} from "@freeanima/host/core/config";
import { createLlmRuntime } from "@freeanima/host/core/llm";
import type { Logger } from "@freeanima/host/kernel/logging";
import { createLogger } from "@freeanima/host/kernel/logging";
import { createNullSink } from "@freeanima/host/kernel/logging/sinks/null.ts";

export type { EngineCatalog } from "./catalog.ts";
export { createEngineCatalog } from "./catalog.ts";

/** LLM sub-component group (same shape as legacy llm-stack LlmRuntime) */
export type EngineLlm = {
  backends: BackendRegistry;
  providers: ProviderRegistry;
  profiles: ProfileRegistry;
};

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
    readonly llm: EngineLlm,
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
