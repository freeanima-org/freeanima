import {
  llmProviderSchema,
  LLM_PRESET_ALIBABA_TOKEN_PLAN,
} from "@freeanima/habitat/core/config/schemas/llm-config.ts";
import { effectiveProviderModalities, getLlmRuntime } from "@freeanima/habitat/core/llm";
import {
  alibabaBuiltinImageGenerateEntries,
  filterImageGenerateCatalog,
} from "@freeanima/habitat/core/llm/image-generate-models.ts";
import {
  alibabaBuiltinVoiceGenerateEntries,
  filterVoiceGenerateCatalog,
} from "@freeanima/habitat/core/llm/voice-generate-models.ts";
import type {
  ModelInfo,
  ModelInputModality,
  ModelOutputModality,
} from "@freeanima/habitat/core/provider";
import { listModelInfoFromModelsDev } from "@freeanima/habitat/capabilities/llm-openai/models-dev";
import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  CATALOG_DEFAULT_CONTEXT_WINDOW,
  CATALOG_DEFAULT_MAX_OUTPUT_TOKENS,
} from "@freeanima/habitat/capabilities/llm-openai/models-dev/enrich.ts";

import { ApiHandlerError } from "./errors.ts";
import { habitatCtx } from "./runtime.ts";

export type ListProviderModelsPurpose =
  | "chat"
  | "image_generate"
  | "embedding"
  | "voice_generate"
  | "video_generate";

export type ListProviderModelsInput = {
  provider_id: string;
  query?: string;
  limit?: number;
  /** 按用途筛选目录；缺省 = 全量（对话） */
  purpose?: ListProviderModelsPurpose;
};

export type ListProviderModelsEntry = {
  model: string;
  label?: string;
  contextWindow: number;
  maxOutputTokens: number;
  cost?: { input?: number; output?: number };
  inputModalities?: ModelInputModality[];
  outputModalities?: ModelOutputModality[];
};

export type ListProviderModelsResult = {
  models: ListProviderModelsEntry[];
  source: "provider" | "models_dev" | "builtin";
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function serializeModel(info: ModelInfo): ListProviderModelsEntry {
  return omitUndefined({
    model: info.model,
    label: info.label,
    contextWindow: info.contextWindow,
    maxOutputTokens: info.maxOutputTokens,
    cost: info.cost,
    inputModalities: info.inputModalities,
    outputModalities: info.outputModalities,
  });
}

function filterModels(models: ModelInfo[], query: string | undefined, limit: number): ModelInfo[] {
  const q = query?.trim().toLowerCase() ?? "";
  const out: ModelInfo[] = [];
  for (const info of models) {
    if (q) {
      const hay = `${info.model} ${info.label ?? ""}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    out.push(info);
    if (out.length >= limit) break;
  }
  return out;
}

function entriesToModelInfo(
  entries: ReturnType<typeof alibabaBuiltinImageGenerateEntries>,
): ModelInfo[] {
  return entries.map((entry) => ({
    model: entry.model,
    ...(entry.label != null ? { label: entry.label } : {}),
    contextWindow: entry.contextWindow ?? CATALOG_DEFAULT_CONTEXT_WINDOW,
    maxOutputTokens: entry.maxOutputTokens ?? CATALOG_DEFAULT_MAX_OUTPUT_TOKENS,
    ...(entry.outputModalities
      ? { outputModalities: [...entry.outputModalities] as ModelOutputModality[] }
      : {}),
  }));
}

function applyPurposeFilter(
  models: ModelInfo[],
  purpose: ListProviderModelsPurpose | undefined,
  query: string | undefined,
  limit: number,
): ModelInfo[] {
  if (purpose === "image_generate") {
    return filterImageGenerateCatalog(models, {
      ...(query != null && query !== "" ? { query } : {}),
      limit,
    }).map((entry): ModelInfo => {
      if ("contextWindow" in entry && typeof entry.contextWindow === "number") {
        return entry;
      }
      return {
        model: entry.model,
        ...(entry.label != null ? { label: entry.label } : {}),
        contextWindow: CATALOG_DEFAULT_CONTEXT_WINDOW,
        maxOutputTokens: CATALOG_DEFAULT_MAX_OUTPUT_TOKENS,
      };
    });
  }
  if (purpose === "voice_generate") {
    return filterVoiceGenerateCatalog(models, {
      ...(query != null && query !== "" ? { query } : {}),
      limit,
    }).map((entry): ModelInfo => {
      if ("contextWindow" in entry && typeof entry.contextWindow === "number") {
        return entry;
      }
      return {
        model: entry.model,
        ...(entry.label != null ? { label: entry.label } : {}),
        contextWindow: CATALOG_DEFAULT_CONTEXT_WINDOW,
        maxOutputTokens: CATALOG_DEFAULT_MAX_OUTPUT_TOKENS,
      };
    });
  }
  return filterModels(models, query, limit);
}

/** List models for an LLM Connection: provider `/models` (enriched) or models.dev fallback. */
export async function listProviderModels(
  input: ListProviderModelsInput,
): Promise<ListProviderModelsResult> {
  const providerId = input.provider_id.trim();
  if (!providerId) {
    throw new ApiHandlerError(400, "provider_id 不能为空", { code: "invalid_provider_id" });
  }

  const limit = input.limit ?? 200;
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

  const modalities = effectiveProviderModalities(providerCfg);
  if (input.purpose === "image_generate" && !modalities.image_protocol) {
    return { models: [], source: "provider" };
  }
  if (input.purpose === "voice_generate" && !modalities.voice_protocol) {
    return { models: [], source: "provider" };
  }

  // 阿里云 Token Plan：文生图用内置「图片生成」表，不拿 /models 里的对话模型冒充
  if (input.purpose === "image_generate" && providerCfg.preset === LLM_PRESET_ALIBABA_TOKEN_PLAN) {
    const builtin = entriesToModelInfo(
      alibabaBuiltinImageGenerateEntries({
        ...(input.query != null && input.query !== "" ? { query: input.query } : {}),
        limit,
      }),
    );
    return { models: builtin.map(serializeModel), source: "builtin" };
  }

  if (input.purpose === "voice_generate" && providerCfg.preset === LLM_PRESET_ALIBABA_TOKEN_PLAN) {
    const builtin = entriesToModelInfo(
      alibabaBuiltinVoiceGenerateEntries({
        ...(input.query != null && input.query !== "" ? { query: input.query } : {}),
        limit,
      }),
    );
    return { models: builtin.map(serializeModel), source: "builtin" };
  }

  let fromProvider: ModelInfo[] = [];
  try {
    const runtime = getLlmRuntime();
    if (runtime.providers.has(providerId)) {
      fromProvider = await Promise.race([
        runtime.providers.get(providerId).listModels(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("listModels timeout")), 12_000);
        }),
      ]);
    }
  } catch {
    fromProvider = [];
  }

  if (fromProvider.length > 0) {
    return {
      models: applyPurposeFilter(fromProvider, input.purpose, input.query, limit).map(
        serializeModel,
      ),
      source: "provider",
    };
  }

  const fromDev = await listModelInfoFromModelsDev(providerCfg.preset ?? "custom", {
    ...(input.purpose !== "image_generate" && input.query != null && input.query !== ""
      ? { query: input.query }
      : {}),
    limit: input.purpose === "image_generate" ? 500 : limit,
  });
  return {
    models: applyPurposeFilter(fromDev, input.purpose, input.query, limit).map(serializeModel),
    source: "models_dev",
  };
}
