import {
  isConversationMeta,
  type OpenAiToolSchema,
  type ConversationMetaLoadResult,
  type CompressionState,
} from "@freeanima/core/db/domain";
import {
  getActiveConfig,
  budgetFromContextWindow,
  lookupCatalogContextWindow,
  resolveContextWindowWithSource,
  type ContextWindowSource,
} from "@freeanima/core/config";
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

function enrichCompressOptionsWithWindow(
  base: CompressOptions,
  window: number,
  source: ContextWindowSource,
  catalogContextWindow?: number,
): CompressOptions {
  const cfg = getActiveConfig().data;
  return {
    ...base,
    catalogContextWindow,
    contextWindow: window,
    contextWindowSource: source,
    effectiveBudgetOverride: budgetFromContextWindow(cfg, window),
  };
}

/** Async: config > default > Provider catalog; sets effectiveBudgetOverride when token mode applies */
export async function buildCompressOptionsResolved(
  meta: ConversationMetaLoadResult,
  state: CompressionState | null,
  fallbackModel: string,
  overrides?: {
    forceEmergency?: boolean;
    force?: boolean;
    tools?: OpenAiToolSchema[];
  },
): Promise<CompressOptions> {
  const base = buildCompressOptions(meta, state, fallbackModel, overrides);
  const model = base.model ?? "";
  if (!model) return base;

  const cfg = getActiveConfig().data;
  const sync = resolveContextWindowWithSource(cfg, model);
  if (sync.window != null && sync.source != null) {
    return enrichCompressOptionsWithWindow(base, sync.window, sync.source);
  }

  const catalogWindow = await lookupCatalogContextWindow(model);
  const resolved = resolveContextWindowWithSource(cfg, model, { catalogFallback: catalogWindow });
  if (resolved.window == null || resolved.source == null) {
    return base;
  }
  return enrichCompressOptionsWithWindow(
    base,
    resolved.window,
    resolved.source,
    catalogWindow ?? undefined,
  );
}
