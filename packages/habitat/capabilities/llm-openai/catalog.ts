import type OpenAI from "openai";
import type { ModelInfo, SupportedParam } from "@freeanima/habitat/core/provider";
import {
  CATALOG_DEFAULT_CONTEXT_WINDOW,
  CATALOG_DEFAULT_MAX_OUTPUT_TOKENS,
  enrichModelInfoFromModelsDev,
} from "./models-dev/enrich.ts";

const DEFAULT_SUPPORTED_PARAMS: SupportedParam[] = [
  "temperature",
  "maxOutputTokens",
  "topP",
  "stop",
  "extra",
  "tools",
  "streaming",
  "reasoning",
];

const DEFAULT_MODEL_INFO = {
  contextWindow: CATALOG_DEFAULT_CONTEXT_WINDOW,
  maxOutputTokens: CATALOG_DEFAULT_MAX_OUTPUT_TOKENS,
  supportedParams: DEFAULT_SUPPORTED_PARAMS,
} as const;

/** Fallback catalog when no /models entries; optionally enriched via models.dev. */
export function defaultModelInfo(model: string): ModelInfo {
  return {
    model,
    contextWindow: DEFAULT_MODEL_INFO.contextWindow,
    maxOutputTokens: DEFAULT_MODEL_INFO.maxOutputTokens,
    supportedParams: [...DEFAULT_MODEL_INFO.supportedParams],
  };
}

/** defaultModelInfo + models.dev enrich (context / cost / label). */
export async function defaultModelInfoEnriched(model: string): Promise<ModelInfo> {
  return enrichModelInfoFromModelsDev(defaultModelInfo(model), { preferModelsDevLimits: true });
}

type OpenAiModelObject = OpenAI.Models.Model;

function inferMaxOutputTokens(model: OpenAI.Models.Model): number {
  const raw = model as OpenAiModelObject & {
    max_output_tokens?: number;
    top_provider?: { max_completion_tokens?: number };
  };
  if (typeof raw.max_output_tokens === "number" && raw.max_output_tokens > 0) {
    return raw.max_output_tokens;
  }
  if (raw.top_provider?.max_completion_tokens != null) {
    return raw.top_provider.max_completion_tokens;
  }
  return DEFAULT_MODEL_INFO.maxOutputTokens;
}

/** Parse context window from provider-specific /models fields when present */
export function inferContextWindow(model: OpenAI.Models.Model): number {
  const raw = model as OpenAiModelObject & {
    context_length?: number;
    context_window?: number;
    max_model_len?: number;
    top_provider?: { context_length?: number };
  };
  const candidates = [
    raw.context_length,
    raw.context_window,
    raw.max_model_len,
    raw.top_provider?.context_length,
  ];
  for (const value of candidates) {
    if (typeof value === "number" && value > 0) return value;
  }
  return DEFAULT_MODEL_INFO.contextWindow;
}

function toModelInfo(model: OpenAI.Models.Model): ModelInfo {
  return {
    model: model.id,
    contextWindow: inferContextWindow(model),
    maxOutputTokens: inferMaxOutputTokens(model),
    supportedParams: [...DEFAULT_MODEL_INFO.supportedParams],
    label: model.id,
  };
}

export async function fetchModelCatalog(client: OpenAI): Promise<ModelInfo[]> {
  const models: ModelInfo[] = [];
  for await (const model of client.models.list()) {
    if (!model.id) continue;
    models.push(toModelInfo(model));
  }
  return models;
}

export function findModelInCatalog(catalog: ModelInfo[], model: string): ModelInfo | null {
  return catalog.find((entry) => entry.model === model) ?? null;
}
