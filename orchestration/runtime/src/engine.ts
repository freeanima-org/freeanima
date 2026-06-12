import type { EngineCatalog } from "./catalog.ts";
import { createEngineCatalog } from "./catalog.ts";
import type {
  BackendRegistry,
  ProfileRegistry,
  ProviderRegistry,
} from "@freeanima/storage-provider-llm";
import type { PgRepositories } from "@freeanima/storage-repos";
import { nullPgRepositories } from "@freeanima/storage-repos";
import type { Config } from "@freeanima/storage-config";
import {
  bindActiveConfig,
  registerRuntimeLogger,
  resetActiveConfigForTest,
  resetRuntimeLoggerForTest,
} from "@freeanima/storage-config";
import { createLlmRuntime } from "@freeanima/mechanism-llm";
import type { Logger } from "@freeanima/kernel/logging";
import { createLogger } from "@freeanima/kernel/logging";
import { createNullSink } from "@freeanima/kernel/logging/null";

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
  repos?: PgRepositories;
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
export function createEngine(deps: EngineDeps): RuntimeBundle {
  const logger = deps.logger ?? defaultLogger();
  bindActiveConfig(deps.config);
  registerRuntimeLogger(logger);
  return new RuntimeBundle(
    deps.catalog ?? createEngineCatalog(),
    deps.llm ?? defaultLlm(deps.config),
    deps.repos ?? nullPgRepositories,
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
export class RuntimeBundle {
  constructor(
    readonly catalog: EngineCatalog,
    readonly llm: EngineLlm,
    readonly repos: PgRepositories,
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

/** @deprecated Prefer RuntimeBundle */
export type Engine = RuntimeBundle;
