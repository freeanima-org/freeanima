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

/** LLM 子组件群（与 legacy llm-stack 的 LlmRuntime 同形） */
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

/** 构造 Engine；未传入 repos 时使用 nullPgRepositories */
export function createEngine(deps: EngineDeps = {}): Engine {
  return new Engine(
    deps.catalog ?? createEngineCatalog(),
    deps.llm ?? defaultLlm(),
    deps.repos ?? nullPgRepositories,
  );
}

/** 引擎层组合视图 */
export class Engine {
  constructor(
    readonly catalog: EngineCatalog,
    readonly llm: EngineLlm,
    readonly repos: PgRepositories,
  ) {}

  get tools() {
    return this.catalog.tools;
  }

  get toolSets() {
    return this.catalog.toolSets;
  }

  get skills() {
    return this.catalog.skills;
  }
}
