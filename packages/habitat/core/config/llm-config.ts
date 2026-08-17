import type {
  LlmConfig,
  LlmProviderConfig,
  LlmSceneBinding,
  TextProtocolId,
  ImageProtocolId,
  EmbeddingsProtocolId,
  VoiceProtocolId,
} from "./schemas/llm-config.ts";
import type { RuntimeConfig } from "./schemas/runtime-config.ts";
import { getProviderTextProtocol } from "./schemas/llm-config.ts";
import { materializeConnection } from "../llm/presets.ts";

/** LLM 仅存 PG habitat_runtime_config，不在 bootstrap config.yaml */
export const LLM_NOT_CONFIGURED_MESSAGE =
  "LLM 未配置（habitat_runtime_config.llm）；请在 Shell 设置 → Habitat 服务中配置";

export function tryGetLlmConfig(cfg: RuntimeConfig): LlmConfig | undefined {
  return cfg.llm;
}

/** 是否已有可用 profile 或 scenes（缺省或空段视为未配置，不挡 Habitat 启动） */
export function isLlmConfigured(cfg: RuntimeConfig): boolean {
  const llm = tryGetLlmConfig(cfg);
  if (!llm) return false;
  if (Object.keys(llm.profiles).length > 0) return true;
  return llm.scenes != null && Object.keys(llm.scenes).length > 0;
}

export function getLlmConfig(cfg: RuntimeConfig): LlmConfig {
  const llm = tryGetLlmConfig(cfg);
  if (!llm) {
    throw new Error(LLM_NOT_CONFIGURED_MESSAGE);
  }
  return llm;
}

export function getDefaultProfileId(cfg: RuntimeConfig): string {
  const llm = getLlmConfig(cfg);
  return llm.default_scene ?? llm.default_profile;
}

function profileHasUsableChain(
  llm: { profiles: Record<string, { chain?: Array<{ model?: string }> | undefined }> },
  id: string,
): boolean {
  return Boolean(llm.profiles[id]?.chain?.[0]?.model);
}

function sceneHasUsableBinding(
  llm: { scenes?: Record<string, LlmSceneBinding> | undefined },
  purpose: string,
): boolean {
  const s = llm.scenes?.[purpose];
  return Boolean(s?.connection && s?.model);
}

/**
 * 从遗留 profiles + bindings 合成扁平 scenes（不写回）。
 * 已有 scenes 时以 scenes 为准并补全缺失用途。
 */
export function materializeLlmScenes(llm: LlmConfig): Record<string, LlmSceneBinding> {
  const out: Record<string, LlmSceneBinding> = { ...llm.scenes };

  const ensureFromProfile = (purpose: string, profileId: string) => {
    if (out[purpose]) return;
    const hop = llm.profiles[profileId]?.chain?.[0];
    if (!hop?.provider || !hop.model) return;
    out[purpose] = {
      connection: hop.provider,
      model: hop.model,
      ...(hop.params ? { params: hop.params } : {}),
    };
  };

  const defaultId = llm.default_scene ?? llm.default_profile;
  ensureFromProfile(defaultId, defaultId);
  ensureFromProfile("chat", defaultId);

  const bindings = llm.profile_bindings;
  if (bindings) {
    for (const [purpose, bound] of Object.entries(bindings)) {
      const profileId = bound == null || bound === "" ? defaultId : bound;
      ensureFromProfile(purpose, profileId);
    }
  }

  for (const [id, profile] of Object.entries(llm.profiles)) {
    if (!out[id] && profile.chain?.[0]?.provider && profile.chain[0].model) {
      ensureFromProfile(id, id);
    }
  }

  return out;
}

/**
 * 非对话线场景：不进入 ProfileRegistry（无 chat 后端 / 可无密钥）。
 * embedding / 生图 / TTS 各走专用解析。
 */
export const NON_CHAT_SCENE_PURPOSE_IDS = [
  "embedding",
  "image_generate",
  "voice_generate",
  "tts",
] as const;

export function isNonChatScenePurpose(purpose: string): boolean {
  return (NON_CHAT_SCENE_PURPOSE_IDS as readonly string[]).includes(purpose);
}

/**
 * 从 scenes 合成遗留 profiles（供 ProfileRegistry / 旧路径）。
 * 仅单跳：scenes 覆盖 hop0；忽略 scene.fallback 与旧 chain 尾部。
 * 跳过非对话用途，避免 edge-tts 等无密钥连接被 assertProfilesValid 拒掉。
 */
export function materializeLlmProfilesFromScenes(llm: LlmConfig): LlmConfig["profiles"] {
  const scenes = materializeLlmScenes(llm);
  const profiles: LlmConfig["profiles"] = { ...llm.profiles };

  for (const [purpose, scene] of Object.entries(scenes)) {
    if (isNonChatScenePurpose(purpose)) continue;
    const existing = profiles[purpose];
    const hop0 = { provider: scene.connection, model: scene.model, params: scene.params };
    profiles[purpose] = {
      ...(existing?.title ? { title: existing.title } : {}),
      chain: [hop0],
      ...(existing?.params ? { params: existing.params } : {}),
    };
  }

  // 去掉误写入的非对话 profile（仅 scenes 合成过的）
  for (const purpose of NON_CHAT_SCENE_PURPOSE_IDS) {
    if (llm.profiles[purpose] == null) {
      delete profiles[purpose];
    }
  }

  return profiles;
}

/** 解析后供运行时使用的 llm（scenes 填满 + profiles 与 scenes 对齐） */
export function resolveLlmConfigView(cfg: RuntimeConfig): LlmConfig {
  const llm = getLlmConfig(cfg);
  const scenes = materializeLlmScenes(llm);
  const profiles = materializeLlmProfilesFromScenes({ ...llm, scenes });
  return {
    ...llm,
    default_profile: llm.default_scene ?? llm.default_profile,
    scenes,
    profiles,
  };
}

/**
 * 解析用途键到实际 profile / scene id（兼容 bindings）。
 * - 有 scenes[purpose]：直接用 purpose（扁平场景）
 * - 有 `profile_bindings[requested]`：null/"" → default；否则绑定 id
 * - 无 binding 键：兼容旧配置——有可用 profiles[requested] 则用之
 */
export function resolveConfiguredProfileId(cfg: RuntimeConfig, profileId?: string): string {
  const llm = getLlmConfig(cfg);
  const defaultId = llm.default_scene ?? llm.default_profile;
  const requested = profileId ?? defaultId;

  if (sceneHasUsableBinding(llm, requested)) {
    return requested;
  }

  const bindings = llm.profile_bindings;
  const hasBinding = bindings != null && Object.prototype.hasOwnProperty.call(bindings, requested);

  let preferred: string;
  if (hasBinding) {
    const bound = bindings[requested];
    preferred = bound == null || bound === "" ? defaultId : bound;
  } else {
    preferred = requested;
  }

  if (sceneHasUsableBinding(llm, preferred) || profileHasUsableChain(llm, preferred)) {
    return preferred;
  }
  return defaultId;
}

export type ResolvedScene = {
  purpose: string;
  connection: string;
  model: string;
  params?: Record<string, unknown>;
  textProtocol?: TextProtocolId;
  imageProtocol?: ImageProtocolId | null;
  embeddingsProtocol?: EmbeddingsProtocolId | null;
  voiceProtocol?: VoiceProtocolId | null;
  provider: LlmProviderConfig;
};

export function resolveScene(cfg: RuntimeConfig, purpose?: string): ResolvedScene {
  const llm = resolveLlmConfigView(cfg);
  const id = resolveConfiguredProfileId(cfg, purpose);
  const scene = llm.scenes?.[id];
  const hop = llm.profiles[id]?.chain?.[0];
  const connection = scene?.connection ?? hop?.provider;
  const model = scene?.model ?? hop?.model;
  if (!connection || !model) {
    throw new Error(`llm scene "${id}" missing connection/model`);
  }
  const provider = llm.providers[connection];
  if (!provider) {
    throw new Error(`llm.providers.${connection} not found`);
  }
  const params = scene?.params ?? hop?.params;
  const textProtocol = getProviderTextProtocol(provider);
  return {
    purpose: id,
    connection,
    model,
    ...(params ? { params } : {}),
    ...(textProtocol ? { textProtocol } : {}),
    imageProtocol: provider.image_protocol ?? null,
    embeddingsProtocol: provider.embeddings_protocol ?? null,
    voiceProtocol: provider.voice_protocol ?? null,
    provider,
  };
}

export function getProfileHopModel(cfg: RuntimeConfig, profileId?: string): string {
  return resolveScene(cfg, profileId).model;
}

export function getProfileHopProviderId(cfg: RuntimeConfig, profileId?: string): string {
  return resolveScene(cfg, profileId).connection;
}

/** chat hop 所用 provider 的 wire format（可能未配置） */
export function getProfileHopFormat(cfg: RuntimeConfig, profileId?: string): string | undefined {
  return resolveScene(cfg, profileId).textProtocol;
}

export function getProviderBaseUrl(cfg: RuntimeConfig, providerId: string): string {
  const prov = getLlmConfig(cfg).providers[providerId];
  if (!prov) {
    throw new Error(`llm.providers.${providerId} not found`);
  }
  try {
    return materializeConnection(prov).baseUrl;
  } catch {
    if (!prov.base_url) {
      throw new Error(`llm.providers.${providerId} base_url not configured`);
    }
    return prov.base_url;
  }
}

/** base_url of provider used by default profile */
export function getDefaultProviderBaseUrl(cfg: RuntimeConfig): string {
  const providerId = getProfileHopProviderId(cfg);
  return getProviderBaseUrl(cfg, providerId);
}
