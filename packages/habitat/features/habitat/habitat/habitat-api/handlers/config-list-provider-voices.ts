import {
  llmProviderSchema,
  type VoiceProtocolId,
} from "@freeanima/habitat/core/config/schemas/llm-config.ts";
import { effectiveProviderModalities } from "@freeanima/habitat/core/llm";
import {
  listVoiceCatalog,
  type VoiceCatalogEntry,
} from "@freeanima/habitat/core/tts/voice-catalog.ts";

import { ApiHandlerError } from "./errors.ts";
import { habitatCtx } from "./runtime.ts";

export type ListProviderVoicesInput = {
  provider_id: string;
  /** 合成模型；阿里用于过滤音色 */
  model?: string;
  query?: string;
  limit?: number;
};

export type ListProviderVoicesResult = {
  voices: VoiceCatalogEntry[];
  protocol: VoiceProtocolId;
  source: "builtin";
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** 按连接 voice_protocol 返回静态音色目录（与 listProviderModels 分维） */
export async function listProviderVoices(
  input: ListProviderVoicesInput,
): Promise<ListProviderVoicesResult> {
  const providerId = input.provider_id.trim();
  if (!providerId) {
    throw new ApiHandlerError(400, "provider_id 不能为空", { code: "invalid_provider_id" });
  }

  const connections = asRecord(habitatCtx().engine.config.data.connections);
  const raw = connections[providerId];
  if (raw == null) {
    throw new ApiHandlerError(404, `连接不存在: ${providerId}`, {
      code: "provider_not_found",
      params: { provider_id: providerId },
    });
  }

  let providerCfg;
  try {
    providerCfg = llmProviderSchema.parse(raw);
  } catch (err) {
    throw new ApiHandlerError(400, err instanceof Error ? err.message : String(err), {
      code: "invalid_provider_config",
    });
  }

  const protocol = effectiveProviderModalities(providerCfg).voice_protocol;
  if (!protocol) {
    throw new ApiHandlerError(400, "该连接未配置语音协议（audio_protocol）", {
      code: "voice_protocol_missing",
    });
  }

  const voices = listVoiceCatalog({
    protocol,
    ...(input.model?.trim() ? { model: input.model.trim() } : {}),
    ...(input.query != null && input.query !== "" ? { query: input.query } : {}),
    limit: input.limit ?? 200,
  }).map((entry) => ({
    id: entry.id,
    label: entry.label,
    ...(entry.lang ? { lang: entry.lang } : {}),
    ...(entry.models ? { models: [...entry.models] } : {}),
  }));

  return { voices, protocol, source: "builtin" as const };
}
