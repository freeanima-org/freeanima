import type { LlmConfig, AnimaConfig } from "./schemas/config.ts";
import type { RuntimeConfig } from "./schemas/runtime-config.ts";

/** LLM 仅存 PG habitat_runtime_config，不在 bootstrap config.yaml */
export const LLM_NOT_CONFIGURED_MESSAGE =
  "LLM 未配置（habitat_runtime_config.llm）；请在 Shell 设置 → Habitat 服务中配置后重启服务";

export function tryGetLlmConfig(cfg: AnimaConfig | RuntimeConfig): LlmConfig | undefined {
  return cfg.llm;
}

/** 是否已有可用 profile（缺省或空段视为未配置，不挡 Habitat 启动） */
export function isLlmConfigured(cfg: AnimaConfig | RuntimeConfig): boolean {
  const llm = tryGetLlmConfig(cfg);
  if (!llm) return false;
  return Object.keys(llm.profiles).length > 0;
}

export function getLlmConfig(cfg: AnimaConfig): LlmConfig {
  const llm = tryGetLlmConfig(cfg);
  if (!llm) {
    throw new Error(LLM_NOT_CONFIGURED_MESSAGE);
  }
  return llm;
}

export function getDefaultProfileId(cfg: AnimaConfig): string {
  return getLlmConfig(cfg).default_profile;
}

/** 场景 profile 未配置时回退 llm.default_profile */
export function resolveConfiguredProfileId(cfg: AnimaConfig, profileId?: string): string {
  const llm = getLlmConfig(cfg);
  const preferred = profileId ?? llm.default_profile;
  if (llm.profiles[preferred]?.chain[0]?.model) {
    return preferred;
  }
  return llm.default_profile;
}

export function getProfileHopModel(cfg: AnimaConfig, profileId?: string): string {
  const id = resolveConfiguredProfileId(cfg, profileId);
  const profile = getLlmConfig(cfg).profiles[id];
  if (!profile?.chain[0]?.model) {
    throw new Error(`llm.profiles.${id} missing chain[0].model`);
  }
  return profile.chain[0].model;
}

export function getProfileHopProviderId(cfg: AnimaConfig, profileId?: string): string {
  const id = resolveConfiguredProfileId(cfg, profileId);
  const hop = getLlmConfig(cfg).profiles[id]?.chain[0];
  if (!hop?.provider) {
    throw new Error(`llm.profiles.${id} missing chain[0].provider`);
  }
  return hop.provider;
}

export function getProviderBaseUrl(cfg: AnimaConfig, providerId: string): string {
  const prov = getLlmConfig(cfg).providers[providerId];
  if (!prov?.base_url) {
    throw new Error(`llm.providers.${providerId} base_url not configured`);
  }
  return prov.base_url;
}

/** base_url of provider used by default profile */
export function getDefaultProviderBaseUrl(cfg: AnimaConfig): string {
  const providerId = getProfileHopProviderId(cfg);
  return getProviderBaseUrl(cfg, providerId);
}
