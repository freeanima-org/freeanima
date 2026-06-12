import {
  isSessionMeta,
  type OpenAiToolSchema,
  type SessionMetaLoadResult,
  type CompressionState,
} from "@freeanima/core/db/domain";
import { getCompressionConfig } from "./compression-config.ts";
import type { CompressOptions } from "./compressor.ts";

export type SessionCompressionFields = {
  model: string;
  systemPrompt: string;
};

/** Parse compression/analysis shared fields from session meta (or defaults) */
export function resolveSessionCompressionFields(
  meta: SessionMetaLoadResult,
  fallbackModel: string,
): SessionCompressionFields {
  const model = isSessionMeta(meta) ? meta.model : fallbackModel;
  const systemPrompt = isSessionMeta(meta) ? (meta.system_prompt ?? "") : "";
  return { model, systemPrompt };
}

/** Build shared options for compress / analyzeCompression */
export function buildCompressOptions(
  meta: SessionMetaLoadResult,
  state: CompressionState | null,
  fallbackModel: string,
  overrides?: {
    forceEmergency?: boolean;
    force?: boolean;
    tools?: OpenAiToolSchema[];
  },
): CompressOptions {
  const cfg = getCompressionConfig();
  const { model, systemPrompt } = resolveSessionCompressionFields(meta, fallbackModel);
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
