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
};

function defaultLlm(): EngineLlm {
  const backends = new BackendRegistryImpl();
  const providers = new ProviderRegistryImpl(backends);
  const profiles = new ProfileRegistryImpl([], "chat", providers);
  return { backends, providers, profiles };
}

/** Construct Engine; uses nullPgRepositories when repos omitted */
export function createEngine(deps: EngineDeps = {}): Engine {
  return new Engine(
    deps.catalog ?? createEngineCatalog(),
    deps.llm ?? defaultLlm(),
    deps.repos ?? nullPgRepositories,
  );
}

/** Engine-layer composition view */
export class Engine {
  constructor(
    readonly catalog: EngineCatalog,
    readonly llm: EngineLlm,
    readonly repos: PgRepositories,
  ) {}

  get tools() {
    return this.catalog.toolSets;
  }

  get toolSets() {
    return this.catalog.toolSets;
  }

  get skills() {
    return this.catalog.skills;
  }
}
