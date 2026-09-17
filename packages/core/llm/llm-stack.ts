import type { RuntimeConfig } from "@freeanima/core/config";
import { isLlmConfigured, textGenerateProfileHops } from "@freeanima/core/config";
import {
  assertProfilesValid,
  BackendRegistry,
  type LlmProfileDef,
  ProfileRegistry,
  ProviderRegistry,
} from "@freeanima/core/provider";

import { omitUndefined } from "@freeanima/core/util";
import { applyLlmStackConfigurator } from "./llm-stack-configurator.ts";
import { resolveConfiguredProfileId } from "@freeanima/core/config/llm-config.ts";

export type LlmRuntime = {
  backends: BackendRegistry;
  providers: ProviderRegistry;
  profiles: ProfileRegistry;
  resolveProfileId: (purpose?: string) => string;
};

function profileDefsFromConfig(cfg: RuntimeConfig): LlmProfileDef[] {
  return textGenerateProfileHops(cfg).map((hop) =>
    omitUndefined({
      id: hop.id,
      chain: [
        omitUndefined({
          provider: hop.connection,
          model: hop.model,
          params: hop.params,
        }),
      ],
    }),
  );
}

/** Build an LLM runtime from config, applying the mounted `ctx.llmStack` configurator. */
export function createLlmRuntime(cfg: RuntimeConfig): LlmRuntime {
  const backends = new BackendRegistry();
  const providers = new ProviderRegistry(backends);
  applyLlmStackConfigurator(cfg, backends, providers);

  const defs = profileDefsFromConfig(cfg).filter((def) =>
    def.chain.every((hop) => providers.has(hop.provider)),
  );
  const hasChat = defs.some((def) => def.id === "chat");
  if (!isLlmConfigured(cfg) || !hasChat) {
    return {
      backends,
      providers,
      profiles: new ProfileRegistry([], "", providers),
      resolveProfileId: (id) => id ?? "",
    };
  }

  const profileRegistry = new ProfileRegistry(defs, "chat", providers);
  assertProfilesValid(defs, providers);

  return {
    backends,
    providers,
    profiles: profileRegistry,
    resolveProfileId: (purpose) => resolveConfiguredProfileId(cfg, purpose),
  };
}
