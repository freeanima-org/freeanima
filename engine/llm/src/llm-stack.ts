import type { NestConfig } from "@freeanima/legacy-kernel";
import { getLlmConfig } from "@freeanima/legacy-kernel";
import {
  OpenAiCompatibleBackend,
  OPENAI_COMPATIBLE_BACKEND_ID,
  parseOpenAiCompatibleProviderSpec,
} from "@freeanima/capabilities-provider-openai-compatible";
import {
  assertProfilesValid,
  BackendRegistry,
  type LlmCallParams,
  type LlmProfileDef,
  ProfileRegistry,
  ProviderRegistry,
} from "@freeanima/engine-provider-llm";

export type LlmRuntime = {
  backends: BackendRegistry;
  providers: ProviderRegistry;
  profiles: ProfileRegistry;
};

let runtime: LlmRuntime | null = null;

function profileDefsFromConfig(cfg: NestConfig): LlmProfileDef[] {
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

export function createLlmRuntime(cfg: NestConfig): LlmRuntime {
  const backends = new BackendRegistry();
  backends.register(new OpenAiCompatibleBackend(OPENAI_COMPATIBLE_BACKEND_ID));

  const providers = new ProviderRegistry(backends);
  const llm = getLlmConfig(cfg);

  for (const [id, raw] of Object.entries(llm.providers)) {
    const record = raw as Record<string, unknown>;
    if (record.backend === OPENAI_COMPATIBLE_BACKEND_ID) {
      providers.registerSpec(parseOpenAiCompatibleProviderSpec(id, record));
    } else {
      throw new Error(`不支持的 llm.providers.${id}.backend: ${String(record.backend)}`);
    }
  }

  const defs = profileDefsFromConfig(cfg);
  const profileRegistry = new ProfileRegistry(defs, llm.default_profile, providers);
  assertProfilesValid(defs, providers);

  return { backends, providers, profiles: profileRegistry };
}

export function initLlmRuntime(cfg: NestConfig): LlmRuntime {
  runtime = createLlmRuntime(cfg);
  return runtime;
}

export function getLlmRuntime(): LlmRuntime {
  if (!runtime) {
    throw new Error("LLM runtime 未初始化：请先调用 initLlmRuntime()");
  }
  return runtime;
}

export function resetLlmRuntimeForTests(): void {
  runtime = null;
}
