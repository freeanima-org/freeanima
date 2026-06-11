import type { EngineCatalog } from "./catalog.ts";
import { createEngineCatalog } from "./catalog.ts";
import type {
  BackendRegistry,
  ProfileRegistry,
  ProviderRegistry,
} from "@freeanima/engine-provider-llm";
import {
  BackendRegistry as BackendRegistryImpl,
  ProfileRegistry as ProfileRegistryImpl,
  ProviderRegistry as ProviderRegistryImpl,
} from "@freeanima/engine-provider-llm";
import type { PgRepositories } from "@freeanima/engine-repos";
import { nullPgRepositories } from "@freeanima/engine-repos";
import type { AnimaConfig } from "@freeanima/engine-config";
import {
  registerRuntimeConfig,
  registerRuntimeLogger,
  resetRuntimeConfigForTest,
  resetRuntimeLoggerForTest,
} from "@freeanima/engine-config";
import type { Logger } from "@freeanima/kernel-logging";
import { createLogger } from "@freeanima/kernel-logging";
import { createNullSink } from "@freeanima/kernel-logging/null";

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
  config: AnimaConfig;
  logger?: Logger;
};

function defaultLlm(): EngineLlm {
  const backends = new BackendRegistryImpl();
  const providers = new ProviderRegistryImpl(backends);
  const profiles = new ProfileRegistryImpl([], "chat", providers);
  return { backends, providers, profiles };
}

function defaultLogger(): Logger {
  return createLogger({ level: "error", sinks: [createNullSink()] });
}

/** Construct Engine; wires runtime config/logger for mechanism layers */
export function createEngine(deps: EngineDeps): Engine {
  const logger = deps.logger ?? defaultLogger();
  registerRuntimeConfig(deps.config);
  registerRuntimeLogger(logger);
  return new Engine(
    deps.catalog ?? createEngineCatalog(),
    deps.llm ?? defaultLlm(),
    deps.repos ?? nullPgRepositories,
    deps.config,
    logger,
  );
}

/** Reset runtime bindings (unit tests) */
export function resetEngineRuntimeForTests(): void {
  resetRuntimeConfigForTest();
  resetRuntimeLoggerForTest();
}

/** Engine-layer composition view */
export class Engine {
  constructor(
    readonly catalog: EngineCatalog,
    readonly llm: EngineLlm,
    readonly repos: PgRepositories,
    readonly config: AnimaConfig,
    readonly logger: Logger,
  ) {}

  get toolSets() {
    return this.catalog.toolSets;
  }

  get skills() {
    return this.catalog.skills;
  }
}
