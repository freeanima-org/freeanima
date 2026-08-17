import type { LlmConfig } from "./schemas/config.ts";
import type { RuntimeConfig } from "./schemas/runtime-config.ts";

/** LLM 仅存 PG habitat_runtime_config，不在 bootstrap config.yaml */
export const LLM_NOT_CONFIGURED_MESSAGE =
  "LLM 未配置（habitat_runtime_config.llm）；请在 Shell 设置 → Habitat 服务中配置";

export function tryGetLlmConfig(cfg: RuntimeConfig): LlmConfig | undefined {
  return cfg.llm;
}

/** 是否已有可用 profile（缺省或空段视为未配置，不挡 Habitat 启动） */
export function isLlmConfigured(cfg: RuntimeConfig): boolean {
  const llm = tryGetLlmConfig(cfg);
  if (!llm) return false;
  return Object.keys(llm.profiles).length > 0;
}

export function getLlmConfig(cfg: RuntimeConfig): LlmConfig {
  const llm = tryGetLlmConfig(cfg);
  if (!llm) {
    throw new Error(LLM_NOT_CONFIGURED_MESSAGE);
  }
  return llm;
}

export function getDefaultProfileId(cfg: RuntimeConfig): string {
  return getLlmConfig(cfg).default_profile;
}

function profileHasUsableChain(
  llm: { profiles: Record<string, { chain?: Array<{ model?: string }> | undefined }> },
  id: string,
): boolean {
  return Boolean(llm.profiles[id]?.chain?.[0]?.model);
}

/**
 * 解析用途键到实际 profile id。
 * - 有 `profile_bindings[requested]`：null/"" → default_profile；否则用绑定 id（不可用再回退 default）
 * - 无 binding 键：兼容旧配置——有可用 profiles[requested] 则用之，否则 default_profile
 */
export function resolveConfiguredProfileId(cfg: RuntimeConfig, profileId?: string): string {
  const llm = getLlmConfig(cfg);
  const requested = profileId ?? llm.default_profile;
  const bindings = llm.profile_bindings;
  const hasBinding = bindings != null && Object.prototype.hasOwnProperty.call(bindings, requested);

  let preferred: string;
  if (hasBinding) {
    const bound = bindings[requested];
    preferred = bound == null || bound === "" ? llm.default_profile : bound;
  } else {
    preferred = requested;
  }

  if (profileHasUsableChain(llm, preferred)) {
    return preferred;
  }
  return llm.default_profile;
}

export function getProfileHopModel(cfg: RuntimeConfig, profileId?: string): string {
  const id = resolveConfiguredProfileId(cfg, profileId);
  const profile = getLlmConfig(cfg).profiles[id];
  if (!profile?.chain[0]?.model) {
    throw new Error(`llm.profiles.${id} missing chain[0].model`);
  }
  return profile.chain[0].model;
}

export function getProfileHopProviderId(cfg: RuntimeConfig, profileId?: string): string {
  const id = resolveConfiguredProfileId(cfg, profileId);
  const hop = getLlmConfig(cfg).profiles[id]?.chain[0];
  if (!hop?.provider) {
    throw new Error(`llm.profiles.${id} missing chain[0].provider`);
  }
  return hop.provider;
}

/** chat hop 所用 provider 的 wire format（可能未配置） */
export function getProfileHopFormat(cfg: RuntimeConfig, profileId?: string): string | undefined {
  const providerId = getProfileHopProviderId(cfg, profileId);
  return getLlmConfig(cfg).providers[providerId]?.format;
}

export function getProviderBaseUrl(cfg: RuntimeConfig, providerId: string): string {
  const prov = getLlmConfig(cfg).providers[providerId];
  if (!prov?.base_url) {
    throw new Error(`llm.providers.${providerId} base_url not configured`);
  }
  return prov.base_url;
}

/** base_url of provider used by default profile */
export function getDefaultProviderBaseUrl(cfg: RuntimeConfig): string {
  const providerId = getProfileHopProviderId(cfg);
  return getProviderBaseUrl(cfg, providerId);
}
