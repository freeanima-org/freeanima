import type { RuntimeConfig, LlmConfig } from "@freeanima/habitat/core/config";
import {
  isLlmConfigured,
  resolveConfiguredProfileId,
  resolveLlmConfigView,
  tryGetLlmConfig,
} from "@freeanima/habitat/core/config";
import {
  assertProfilesValid,
  BackendRegistry,
  type LlmProfileDef,
  ProfileRegistry,
  ProviderRegistry,
} from "@freeanima/habitat/core/provider";

import { omitUndefined } from "@freeanima/habitat/core/util";
import { applyLlmStackConfigurator } from "./llm-stack-configurator.ts";

export type LlmRuntime = {
  backends: BackendRegistry;
  providers: ProviderRegistry;
  profiles: ProfileRegistry;
  /** 用途键 → 实际 profile id（含 profile_bindings / scenes） */
  resolveProfileId: (purpose?: string) => string;
};

let runtime: LlmRuntime | null = null;
/** 构建 runtime 时的 config 快照，供 resolveProfileId 使用 */
let runtimeConfig: RuntimeConfig | null = null;

function profileDefsFromConfig(llm: LlmConfig): LlmProfileDef[] {
  return Object.entries(llm.profiles).map(([id, profile]) =>
    omitUndefined({
      id,
      chain: profile.chain.slice(0, 1).map((hop) =>
        omitUndefined({
          provider: hop.provider,
          model: hop.model,
          params: hop.params,
        }),
      ),
      params: profile.params,
    }),
  );
}

export function createLlmRuntime(cfg: RuntimeConfig): LlmRuntime {
  const backends = new BackendRegistry();
  const providers = new ProviderRegistry(backends);
  applyLlmStackConfigurator(cfg, backends, providers);

  if (!isLlmConfigured(cfg) || !tryGetLlmConfig(cfg)) {
    return {
      backends,
      providers,
      profiles: new ProfileRegistry([], "", providers),
      resolveProfileId: (id) => id ?? "",
    };
  }

  const llm = resolveLlmConfigView(cfg);
  const defs = profileDefsFromConfig(llm);
  const defaultId = llm.default_profile;
  const profileRegistry = new ProfileRegistry(defs, defaultId, providers);
  assertProfilesValid(defs, providers);

  return {
    backends,
    providers,
    profiles: profileRegistry,
    resolveProfileId: (purpose) => resolveConfiguredProfileId(cfg, purpose),
  };
}

export function initLlmRuntime(cfg: RuntimeConfig): LlmRuntime {
  runtimeConfig = cfg;
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
  runtimeConfig = null;
}

export function getLlmRuntimeConfigForTests(): RuntimeConfig | null {
  return runtimeConfig;
}
