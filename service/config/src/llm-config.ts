import type { LlmConfig, NestConfig } from "./schemas/config.ts";

export function getLlmConfig(cfg: NestConfig): LlmConfig {
  if (!cfg.llm) {
    throw new Error("config.yaml 缺少 llm 配置块");
  }
  return cfg.llm;
}

export function getDefaultProfileId(cfg: NestConfig): string {
  return getLlmConfig(cfg).default_profile;
}

export function getProfileHopModel(cfg: NestConfig, profileId?: string): string {
  const llm = getLlmConfig(cfg);
  const id = profileId ?? llm.default_profile;
  const profile = llm.profiles[id];
  if (!profile?.chain[0]?.model) {
    throw new Error(`llm.profiles.${id} 缺少 chain[0].model`);
  }
  return profile.chain[0].model;
}

export function getProfileHopProviderId(cfg: NestConfig, profileId?: string): string {
  const llm = getLlmConfig(cfg);
  const id = profileId ?? llm.default_profile;
  const hop = llm.profiles[id]?.chain[0];
  if (!hop?.provider) {
    throw new Error(`llm.profiles.${id} 缺少 chain[0].provider`);
  }
  return hop.provider;
}

export function getProviderBaseUrl(cfg: NestConfig, providerId: string): string {
  const prov = getLlmConfig(cfg).providers[providerId];
  if (!prov?.base_url) {
    throw new Error(`llm.providers.${providerId} 未配置 base_url`);
  }
  return prov.base_url;
}

/** 默认 profile 所用 provider 的 base_url */
export function getDefaultProviderBaseUrl(cfg: NestConfig): string {
  const providerId = getProfileHopProviderId(cfg);
  return getProviderBaseUrl(cfg, providerId);
}
