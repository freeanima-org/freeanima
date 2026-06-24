import {
  isConversationMeta,
  type OpenAiToolSchema,
  type ConversationMetaLoadResult,
  type CompressionState,
} from "@freeanima/core/db/domain";
import { getCompressionConfig } from "./compression-config.ts";
import type { CompressOptions } from "./compressor.ts";

export type ConversationCompressionFields = {
  model: string;
  systemPrompt: string;
};

/** Parse compression/analysis shared fields from conversation meta (or defaults) */
export function resolveConversationCompressionFields(
  meta: ConversationMetaLoadResult,
  fallbackModel: string,
): ConversationCompressionFields {
  const model = isConversationMeta(meta) ? meta.model : fallbackModel;
  const systemPrompt = isConversationMeta(meta) ? (meta.system_prompt ?? "") : "";
  return { model, systemPrompt };
}

/** Build shared options for compress / analyzeCompression */
export function buildCompressOptions(
  meta: ConversationMetaLoadResult,
  state: CompressionState | null,
  fallbackModel: string,
  overrides?: {
    forceEmergency?: boolean;
    force?: boolean;
    tools?: OpenAiToolSchema[];
  },
): CompressOptions {
  const cfg = getCompressionConfig();
  const { model, systemPrompt } = resolveConversationCompressionFields(meta, fallbackModel);
  return {
    maxRounds: cfg.maxRounds,
    model,
    systemPrompt,
    tools: overrides?.tools ?? [],
    state,
    forceEmergency: overrides?.forceEmergency,
    force: overrides?.force,
  };
}
