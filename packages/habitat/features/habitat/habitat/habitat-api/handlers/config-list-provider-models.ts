import { llmProviderSchema } from "@freeanima/habitat/core/config/schemas/llm-config.ts";
import { getLlmRuntime } from "@freeanima/habitat/core/llm";
import type { ModelInfo } from "@freeanima/habitat/core/provider";
import { listModelInfoFromModelsDev } from "@freeanima/habitat/capabilities/llm-openai/models-dev";
import { omitUndefined } from "@freeanima/habitat/core/util";

import { ApiHandlerError } from "./errors.ts";
import { habitatCtx } from "./runtime.ts";

export type ListProviderModelsInput = {
  provider_id: string;
  query?: string;
  limit?: number;
};

export type ListProviderModelsEntry = {
  model: string;
  label?: string;
  contextWindow: number;
  maxOutputTokens: number;
  cost?: { input?: number; output?: number };
};

export type ListProviderModelsResult = {
  models: ListProviderModelsEntry[];
  source: "provider" | "models_dev";
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

/** List models for an LLM Connection: provider `/models` (enriched) or models.dev fallback. */
export async function listProviderModels(
  input: ListProviderModelsInput,
): Promise<ListProviderModelsResult> {
  const providerId = input.provider_id.trim();
  if (!providerId) {
    throw new ApiHandlerError(400, "provider_id 不能为空", { code: "invalid_provider_id" });
  }

  const limit = input.limit ?? 200;
  const llm = asRecord(habitatCtx().engine.config.data.llm);
  const providers = asRecord(llm.providers);
  const raw = providers[providerId];
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
      models: filterModels(fromProvider, input.query, limit).map(serializeModel),
      source: "provider",
    };
  }

  const fromDev = await listModelInfoFromModelsDev(providerCfg.preset ?? "custom", {
    ...(input.query != null && input.query !== "" ? { query: input.query } : {}),
    limit,
  });
  return {
    models: fromDev.map(serializeModel),
    source: "models_dev",
  };
}
