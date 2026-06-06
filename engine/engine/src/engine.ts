import type { ToolRegistry } from "@freeanima/engine-tool";
import { defaultToolRegistry } from "@freeanima/engine-tool";
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

/** LLM 子组件群（与 legacy llm-stack 的 LlmRuntime 同形） */
export type EngineLlm = {
  backends: BackendRegistry;
  providers: ProviderRegistry;
  profiles: ProfileRegistry;
};

export type EngineDeps = {
  tools?: ToolRegistry;
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
    deps.tools ?? defaultToolRegistry,
    deps.llm ?? defaultLlm(),
    deps.repos ?? nullPgRepositories,
  );
}

/** 引擎层组合视图 */
export class Engine {
  constructor(
    readonly tools: ToolRegistry,
    readonly llm: EngineLlm,
    readonly repos: PgRepositories,
  ) {}
}
