import {
  isConversationMeta,
  type OpenAiToolSchema,
  type ConversationMetaLoadResult,
  type CompressionState,
} from "@freeanima/habitat/core/db/domain";
import {
  getActiveRuntimeConfig,
  budgetFromContextWindow,
  lookupCatalogContextWindow,
  type ContextWindowSource,
} from "@freeanima/habitat/core/config";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { getCompressionConfig } from "./compression-config.ts";
import type { CompressOptions } from "./compressor.ts";

export type ConversationCompressionFields = {
  model: string;
  systemPrompt: string;
};

/** Parse compression/analysis shared fields from conversation meta (or defaults).
 * Model always comes from `fallbackModel` (PROFILE_CHAT hop); meta.model is write-only.
 */
export function resolveConversationCompressionFields(
  meta: ConversationMetaLoadResult,
  fallbackModel: string,
): ConversationCompressionFields {
  const systemPrompt = isConversationMeta(meta) ? (meta.system_prompt ?? "") : "";
  return { model: fallbackModel, systemPrompt };
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
  return omitUndefined({
    maxRounds: cfg.maxRounds,
    model,
    systemPrompt,
    tools: overrides?.tools ?? [],
    state,
    forceEmergency: overrides?.forceEmergency,
    force: overrides?.force,
  });
}

function enrichCompressOptionsWithWindow(
  base: CompressOptions,
  window: number,
  source: ContextWindowSource,
  catalogContextWindow?: number,
): CompressOptions {
  const cfg = getActiveRuntimeConfig().data;
  return omitUndefined({
    ...base,
    catalogContextWindow,
    contextWindow: window,
    contextWindowSource: source,
    effectiveBudgetOverride: budgetFromContextWindow(cfg, window),
  });
}

/** Async: Provider catalog contextWindow; sets effectiveBudgetOverride when token mode applies */
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

  const catalogWindow = await lookupCatalogContextWindow(model);
  if (catalogWindow == null || catalogWindow <= 0) {
    return base;
  }
  return enrichCompressOptionsWithWindow(base, catalogWindow, "catalog", catalogWindow);
}
