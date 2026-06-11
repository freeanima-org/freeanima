import type { LlmConfig, AnimaConfig } from "./schemas/config.ts";

export function getLlmConfig(cfg: AnimaConfig): LlmConfig {
  if (!cfg.llm) {
    throw new Error("config.yaml missing llm config block");
  }
  return cfg.llm;
}

export function getDefaultProfileId(cfg: AnimaConfig): string {
  return getLlmConfig(cfg).default_profile;
}

export function getProfileHopModel(cfg: AnimaConfig, profileId?: string): string {
  const llm = getLlmConfig(cfg);
  const id = profileId ?? llm.default_profile;
  const profile = llm.profiles[id];
  if (!profile?.chain[0]?.model) {
    throw new Error(`llm.profiles.${id} missing chain[0].model`);
  }
  return profile.chain[0].model;
}

export function getProfileHopProviderId(cfg: AnimaConfig, profileId?: string): string {
  const llm = getLlmConfig(cfg);
  const id = profileId ?? llm.default_profile;
  const hop = llm.profiles[id]?.chain[0];
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
