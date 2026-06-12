import type { AnimaConfig } from "@freeanima/storage-config";
import { getLlmConfig } from "@freeanima/storage-config";
import {
  assertProfilesValid,
  BackendRegistry,
  type LlmCallParams,
  type LlmProfileDef,
  ProfileRegistry,
  ProviderRegistry,
} from "@freeanima/storage-provider-llm";

import { applyLlmStackConfigurator } from "./llm-stack-configurator.ts";

export type LlmRuntime = {
  backends: BackendRegistry;
  providers: ProviderRegistry;
  profiles: ProfileRegistry;
};

let runtime: LlmRuntime | null = null;

function profileDefsFromConfig(cfg: AnimaConfig): LlmProfileDef[] {
  const llm = getLlmConfig(cfg);
  return Object.entries(llm.profiles).map(([id, profile]) => ({
    id,
    chain: profile.chain.map((hop) => ({
      provider: hop.provider,
      model: hop.model,
      params: hop.params as Partial<LlmCallParams> | undefined,
    })),
    params: profile.params as Partial<LlmCallParams> | undefined,
  }));
}

export function createLlmRuntime(cfg: AnimaConfig): LlmRuntime {
  const backends = new BackendRegistry();
  const providers = new ProviderRegistry(backends);
  applyLlmStackConfigurator(cfg, backends, providers);

  const llm = getLlmConfig(cfg);
  const defs = profileDefsFromConfig(cfg);
  const profileRegistry = new ProfileRegistry(defs, llm.default_profile, providers);
  assertProfilesValid(defs, providers);

  return { backends, providers, profiles: profileRegistry };
}

export function initLlmRuntime(cfg: AnimaConfig): LlmRuntime {
  runtime = createLlmRuntime(cfg);
  return runtime;
}

export function getLlmRuntime(): LlmRuntime {
  if (!runtime) {
    throw new Error("LLM runtime not initialized: call initLlmRuntime() first");
  }
  return runtime;
}

export function resetLlmRuntimeForTests(): void {
  runtime = null;
}
