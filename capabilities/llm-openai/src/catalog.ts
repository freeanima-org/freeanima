import type OpenAI from "openai";
import type { ModelInfo, SupportedParam } from "@freeanima/core/provider";

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
  contextWindow: 128_000,
  maxOutputTokens: 8192,
  supportedParams: DEFAULT_SUPPORTED_PARAMS,
} as const;

/** Fallback catalog when no /models entries */
export function defaultModelInfo(model: string): ModelInfo {
  return {
    model,
    contextWindow: DEFAULT_MODEL_INFO.contextWindow,
    maxOutputTokens: DEFAULT_MODEL_INFO.maxOutputTokens,
    supportedParams: [...DEFAULT_MODEL_INFO.supportedParams],
  };
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

function toModelInfo(model: OpenAI.Models.Model): ModelInfo {
  return {
    model: model.id,
    contextWindow: DEFAULT_MODEL_INFO.contextWindow,
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
