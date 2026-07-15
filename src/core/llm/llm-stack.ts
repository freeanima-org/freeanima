import type { AnimaConfig, LlmConfig } from "@freeanima/core/config";
import { isLlmConfigured, tryGetLlmConfig } from "@freeanima/core/config";
import {
  assertProfilesValid,
  BackendRegistry,
  type LlmCallParams,
  type LlmProfileDef,
  ProfileRegistry,
  ProviderRegistry,
} from "@freeanima/core/provider";

import { omitUndefined } from "@freeanima/core/util";
import { applyLlmStackConfigurator } from "./llm-stack-configurator.ts";

export type LlmRuntime = {
  backends: BackendRegistry;
  providers: ProviderRegistry;
  profiles: ProfileRegistry;
};

let runtime: LlmRuntime | null = null;

function profileDefsFromConfig(llm: LlmConfig): LlmProfileDef[] {
  return Object.entries(llm.profiles).map(([id, profile]) =>
    omitUndefined({
      id,
      chain: profile.chain.map((hop) =>
        omitUndefined({
          provider: hop.provider,
          model: hop.model,
          params: hop.params as Partial<LlmCallParams> | undefined,
        }),
      ),
      params: profile.params as Partial<LlmCallParams> | undefined,
    }),
  );
}

export function createLlmRuntime(cfg: AnimaConfig): LlmRuntime {
  const backends = new BackendRegistry();
  const providers = new ProviderRegistry(backends);
  applyLlmStackConfigurator(cfg, backends, providers);

  const llm = tryGetLlmConfig(cfg);
  if (!isLlmConfigured(cfg) || !llm) {
    return {
      backends,
      providers,
      profiles: new ProfileRegistry([], "", providers),
    };
  }

  const defs = profileDefsFromConfig(llm);
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
