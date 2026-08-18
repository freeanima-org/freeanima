import type {
  AudioProtocolId,
  ConnectionConfig,
  EmbeddingsProtocolId,
  ImageProtocolId,
  TextProtocolId,
} from "./schemas/llm-config.ts";
import type { RuntimeConfig } from "./schemas/runtime-config.ts";
import {
  bindingComplete,
  resolveLayerBinding,
  type CapabilityBinding,
} from "./schemas/capability.ts";
import { getConnectionTextProtocol } from "./schemas/llm-config.ts";
import {
  connectionHasTextCapability,
  effectiveProviderModalities,
  connectionEndpointUrl,
  effectiveTextProtocol,
} from "../llm/presets.ts";

export const LLM_NOT_CONFIGURED_MESSAGE =
  "LLM 未配置（text_generate.main）；请在 Shell 设置 → 文本生成 中配置";

export function getConnections(cfg: RuntimeConfig): Record<string, ConnectionConfig> {
  return cfg.connections ?? {};
}

export function getConnection(cfg: RuntimeConfig, id: string): ConnectionConfig | undefined {
  return getConnections(cfg)[id];
}

export function isLlmConfigured(cfg: RuntimeConfig): boolean {
  const main = cfg.text_generate?.main;
  if (!bindingComplete(main)) return false;
  const conn = getConnection(cfg, main.connection);
  return conn != null && connectionHasTextCapability(conn);
}

export function tryGetTextGenerateMain(cfg: RuntimeConfig): CapabilityBinding | null {
  return resolveLayerBinding(cfg.text_generate);
}

export type ResolvedScene = {
  purpose: string;
  connection: string;
  model: string;
  params?: Record<string, unknown>;
  textProtocol?: TextProtocolId;
  imageProtocol?: ImageProtocolId | null;
  embeddingsProtocol?: EmbeddingsProtocolId | null;
  voiceProtocol?: AudioProtocolId | null;
  audioProtocol?: AudioProtocolId | null;
  videoProtocol?: string | null;
  provider: ConnectionConfig;
};

function resolvePurposeBinding(cfg: RuntimeConfig, purpose: string): CapabilityBinding | null {
  switch (purpose) {
    case "chat":
      return resolveLayerBinding(cfg.text_generate);
    case "summary":
      return resolveLayerBinding(cfg.text_generate, cfg.text_generate?.summary);
    case "reflect":
      return resolveLayerBinding(cfg.text_generate, cfg.text_generate?.reflect);
    case "goal_judge":
      return resolveLayerBinding(cfg.text_generate, cfg.text_generate?.goal_judge);
    case "skill_review":
      return resolveLayerBinding(cfg.text_generate, cfg.text_generate?.skill_review);
    case "image_generate":
      return resolveLayerBinding(cfg.image_generate);
    case "voice_generate":
      return resolveLayerBinding(cfg.audio_generate);
    case "tts":
      return resolveLayerBinding(cfg.audio_generate, cfg.audio_generate?.tts);
    case "voice_realtime":
      return resolveLayerBinding(cfg.audio_generate, cfg.audio_generate?.voice_realtime);
    case "embedding":
      return resolveLayerBinding(cfg.embedding);
    case "video_generate":
      return resolveLayerBinding(cfg.video_generate);
    default:
      return resolveLayerBinding(cfg.text_generate);
  }
}

export function resolveConfiguredProfileId(cfg: RuntimeConfig, profileId?: string): string {
  const requested = profileId ?? "chat";
  if (resolvePurposeBinding(cfg, requested)) return requested;
  if (requested !== "chat" && resolvePurposeBinding(cfg, "chat")) return "chat";
  return requested;
}

export function resolveScene(cfg: RuntimeConfig, purpose?: string): ResolvedScene {
  const id = purpose ?? "chat";
  const binding = resolvePurposeBinding(cfg, id);
  if (!binding) {
    throw new Error(`scene "${id}" missing connection/model`);
  }
  const provider = getConnection(cfg, binding.connection);
  if (!provider) {
    throw new Error(`connections.${binding.connection} not found`);
  }
  const textProtocol = effectiveTextProtocol(provider) ?? getConnectionTextProtocol(provider);
  const modalities = effectiveProviderModalities(provider);
  return {
    purpose: id,
    connection: binding.connection,
    model: binding.model,
    ...(binding.params ? { params: binding.params } : {}),
    ...(textProtocol ? { textProtocol } : {}),
    imageProtocol: modalities.image_protocol,
    embeddingsProtocol: modalities.embeddings_protocol,
    voiceProtocol: modalities.audio_protocol,
    audioProtocol: modalities.audio_protocol,
    videoProtocol: modalities.video_protocol,
    provider,
  };
}

export function resolveVideoGenerate(cfg: RuntimeConfig): ResolvedScene {
  return resolveScene(cfg, "video_generate");
}

export function getProfileHopModel(cfg: RuntimeConfig, profileId?: string): string {
  return resolveScene(cfg, profileId ?? "chat").model;
}

export function getProfileHopProviderId(cfg: RuntimeConfig, profileId?: string): string {
  return resolveScene(cfg, profileId ?? "chat").connection;
}

export function getProfileHopFormat(cfg: RuntimeConfig, profileId?: string): string | undefined {
  return resolveScene(cfg, profileId ?? "chat").textProtocol;
}

export function getProviderBaseUrl(cfg: RuntimeConfig, providerId: string): string {
  const prov = getConnection(cfg, providerId);
  if (!prov) {
    throw new Error(`connections.${providerId} not found`);
  }
  return connectionEndpointUrl(prov);
}

export function getDefaultProviderBaseUrl(cfg: RuntimeConfig): string {
  return getProviderBaseUrl(cfg, getProfileHopProviderId(cfg));
}

export function getDefaultProfileId(_cfg: RuntimeConfig): string {
  return "chat";
}

export const NON_CHAT_SCENE_PURPOSE_IDS = [
  "embedding",
  "image_generate",
  "voice_generate",
  "tts",
  "voice_realtime",
  "video_generate",
] as const;

export function isNonChatScenePurpose(purpose: string): boolean {
  return (NON_CHAT_SCENE_PURPOSE_IDS as readonly string[]).includes(purpose);
}

/** 从 text_generate 合成 ProfileRegistry 用的 hop 列表 */
export function textGenerateProfileHops(cfg: RuntimeConfig): Array<{
  id: string;
  connection: string;
  model: string;
  params?: Record<string, unknown>;
}> {
  const purposes = ["chat", "summary", "reflect", "goal_judge", "skill_review"] as const;
  const out: Array<{
    id: string;
    connection: string;
    model: string;
    params?: Record<string, unknown>;
  }> = [];
  for (const id of purposes) {
    const binding = resolvePurposeBinding(cfg, id);
    if (!binding) continue;
    const conn = getConnection(cfg, binding.connection);
    if (!conn || !connectionHasTextCapability(conn)) continue;
    out.push({
      id,
      connection: binding.connection,
      model: binding.model,
      ...(binding.params ? { params: binding.params } : {}),
    });
  }
  return out;
}
