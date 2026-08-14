import type { Model } from "@opencode-ai/models";
import type { LlmPresetId } from "@freeanima/habitat/core/config/schemas/llm-config";
import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  MODEL_INPUT_MODALITIES,
  type ModelInfo,
  type ModelInputModality,
  type SupportedParam,
} from "@freeanima/habitat/core/provider";

import { loadModelsDevProviders } from "./client.ts";
import {
  listModelsDevForProvider,
  lookupModelsDevModel,
  modelsDevProviderIdForPreset,
} from "./lookup.ts";

/** Hardcoded catalog defaults — treat equal values as "unknown" for models.dev override. */
export const CATALOG_DEFAULT_CONTEXT_WINDOW = 128_000;
export const CATALOG_DEFAULT_MAX_OUTPUT_TOKENS = 8192;

export type EnrichOptions = {
  /** When true, treat current context/maxOut as defaults eligible for models.dev override. */
  preferModelsDevLimits?: boolean;
  preset?: LlmPresetId | null;
};

function supportedParamsFromModelsDev(entry: Model): SupportedParam[] | undefined {
  if (entry.temperature !== false && entry.tool_call) {
    return undefined;
  }
  const params: SupportedParam[] = ["maxOutputTokens", "topP", "stop", "extra", "streaming"];
  if (entry.temperature !== false) params.push("temperature");
  if (entry.tool_call) params.push("tools");
  if (entry.reasoning) params.push("reasoning");
  return params;
}

/** Merge a provider ModelInfo with a models.dev Model entry. */
export function mergeModelInfoWithModelsDev(
  base: ModelInfo,
  entry: Model,
  opts?: EnrichOptions,
): ModelInfo {
  const preferMd = opts?.preferModelsDevLimits === true;
  const contextFromProvider =
    !preferMd && base.contextWindow > 0 && base.contextWindow !== CATALOG_DEFAULT_CONTEXT_WINDOW;
  const maxOutFromProvider =
    !preferMd &&
    base.maxOutputTokens > 0 &&
    base.maxOutputTokens !== CATALOG_DEFAULT_MAX_OUTPUT_TOKENS;

  const contextWindow = contextFromProvider
    ? base.contextWindow
    : entry.limit.context > 0
      ? entry.limit.context
      : base.contextWindow;

  const maxOutputTokens = maxOutFromProvider
    ? base.maxOutputTokens
    : entry.limit.output > 0
      ? entry.limit.output
      : base.maxOutputTokens;

  const cost =
    entry.cost != null
      ? omitUndefined({
          input: entry.cost.input,
          output: entry.cost.output,
        })
      : base.cost;

  const fromMdParams = supportedParamsFromModelsDev(entry);
  const supportedParams = fromMdParams ?? base.supportedParams;

  const modalitiesIn = entry.modalities?.input;
  const supportsVision =
    Array.isArray(modalitiesIn) && modalitiesIn.includes("image")
      ? true
      : Array.isArray(modalitiesIn)
        ? false
        : base.supportsVision;

  const known = new Set<string>(Array.isArray(modalitiesIn) ? modalitiesIn : []);
  const inputModalities: ModelInputModality[] | undefined = Array.isArray(modalitiesIn)
    ? MODEL_INPUT_MODALITIES.filter((m) => known.has(m))
    : base.inputModalities;

  return omitUndefined({
    model: base.model,
    contextWindow,
    maxOutputTokens,
    label: entry.name || base.label || undefined,
    cost: cost && (cost.input != null || cost.output != null) ? cost : undefined,
    supportedParams,
    supportsVision,
    inputModalities: inputModalities?.length ? inputModalities : undefined,
  });
}

/** Enrich one ModelInfo via models.dev lookup (no-op if not found). */
export async function enrichModelInfoFromModelsDev(
  info: ModelInfo,
  opts?: EnrichOptions,
): Promise<ModelInfo> {
  const providers = await loadModelsDevProviders();
  const entry = lookupModelsDevModel(providers, info.model, opts?.preset);
  if (!entry) return info;
  return mergeModelInfoWithModelsDev(info, entry, opts);
}

/** Enrich a catalog list. */
export async function enrichCatalogFromModelsDev(
  catalog: ModelInfo[],
  opts?: EnrichOptions,
): Promise<ModelInfo[]> {
  if (catalog.length === 0) return catalog;
  const providers = await loadModelsDevProviders();
  return catalog.map((info) => {
    const entry = lookupModelsDevModel(providers, info.model, opts?.preset);
    if (!entry) return info;
    return mergeModelInfoWithModelsDev(info, entry, opts);
  });
}

/** Build ModelInfo list from models.dev provider slice (when /models empty or fails). */
export async function listModelInfoFromModelsDev(
  preset: LlmPresetId | null | undefined,
  opts?: { query?: string; limit?: number },
): Promise<ModelInfo[]> {
  const providerId = modelsDevProviderIdForPreset(preset);
  if (!providerId) return [];
  const providers = await loadModelsDevProviders();
  const models = listModelsDevForProvider(providers, providerId, opts);
  return models.map((entry) =>
    mergeModelInfoWithModelsDev(
      {
        model: entry.id,
        contextWindow: CATALOG_DEFAULT_CONTEXT_WINDOW,
        maxOutputTokens: CATALOG_DEFAULT_MAX_OUTPUT_TOKENS,
      },
      entry,
      omitUndefined({ preferModelsDevLimits: true as const, preset }),
    ),
  );
}

export {
  lookupModelsDevModel,
  listModelsDevForProvider,
  modelsDevProviderIdForPreset,
  PRESET_TO_MODELS_DEV_PROVIDER,
} from "./lookup.ts";
export { loadModelsDevProviders, clearModelsDevMemoryCache } from "./client.ts";
