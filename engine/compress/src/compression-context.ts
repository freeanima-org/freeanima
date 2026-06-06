import {
  isSessionMeta,
  type OpenAiToolSchema,
  type SessionMetaLoadResult,
  type CompressionState,
} from "@freeanima/engine-db/domain";
import { getCompressionConfig } from "./compression-config.ts";
import type { CompressOptions } from "./compressor.ts";

export type SessionCompressionFields = {
  model: string;
  systemPrompt: string;
  tools: OpenAiToolSchema[];
};

/** 从 session meta（或缺省）解析压缩/分析共用字段 */
export function resolveSessionCompressionFields(
  meta: SessionMetaLoadResult,
  fallbackModel: string,
): SessionCompressionFields {
  const model = isSessionMeta(meta) ? meta.model : fallbackModel;
  const systemPrompt = isSessionMeta(meta) ? (meta.system_prompt ?? "") : "";
  const tools = isSessionMeta(meta) ? meta.tools : [];
  return { model, systemPrompt, tools };
}

/** 构建 compress / analyzeCompression 共用选项 */
export function buildCompressOptions(
  meta: SessionMetaLoadResult,
  state: CompressionState | null,
  fallbackModel: string,
  overrides?: {
    forceEmergency?: boolean;
    force?: boolean;
  },
): CompressOptions {
  const cfg = getCompressionConfig();
  const { model, systemPrompt, tools } = resolveSessionCompressionFields(meta, fallbackModel);
  return {
    maxRounds: cfg.maxRounds,
    model,
    systemPrompt,
    tools,
    state,
    forceEmergency: overrides?.forceEmergency,
    force: overrides?.force,
  };
}
