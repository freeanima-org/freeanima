import type { Model, ProviderMap } from "@opencode-ai/models";
import type { LlmPresetId } from "@freeanima/habitat/core/config/schemas/llm-config";
import {
  LLM_PRESET_ALIBABA_TOKEN_PLAN,
  LLM_PRESET_CUSTOM,
  LLM_PRESET_DEEPSEEK,
  LLM_PRESET_OPENCODE_GO,
  LLM_PRESET_OPENROUTER,
} from "@freeanima/habitat/core/config/schemas/llm-config";

/** FreeAnima LLM preset → models.dev provider id（内置目录 preset 除外）。 */
export const PRESET_TO_MODELS_DEV_PROVIDER: Record<
  Exclude<LlmPresetId, typeof LLM_PRESET_CUSTOM | typeof LLM_PRESET_ALIBABA_TOKEN_PLAN>,
  string
> = {
  [LLM_PRESET_DEEPSEEK]: "deepseek",
  [LLM_PRESET_OPENROUTER]: "openrouter",
  [LLM_PRESET_OPENCODE_GO]: "opencode-go",
};

export function modelsDevProviderIdForPreset(
  preset: LlmPresetId | null | undefined,
): string | null {
  if (preset == null || preset === LLM_PRESET_CUSTOM || preset === LLM_PRESET_ALIBABA_TOKEN_PLAN) {
    return null;
  }
  return PRESET_TO_MODELS_DEV_PROVIDER[preset] ?? null;
}

/** Find a models.dev Model entry for a Connection model id. */
export function lookupModelsDevModel(
  providers: ProviderMap,
  modelId: string,
  preset?: LlmPresetId | null,
): Model | null {
  const id = modelId.trim();
  if (!id) return null;

  const preferred = modelsDevProviderIdForPreset(preset);
  if (preferred) {
    const fromPreferred = providers[preferred]?.models[id];
    if (fromPreferred) return fromPreferred;
  }

  // OpenRouter / gateway style: "org/model" under openrouter, or bare under org provider
  if (id.includes("/")) {
    const slash = id.indexOf("/");
    const org = id.slice(0, slash);
    const bare = id.slice(slash + 1);
    const fromOrg = providers[org]?.models[bare] ?? providers[org]?.models[id];
    if (fromOrg) return fromOrg;
    const fromOpenrouter = providers.openrouter?.models[id];
    if (fromOpenrouter) return fromOpenrouter;
  }

  // Global scan: prefer exact id match across providers
  for (const provider of Object.values(providers)) {
    const hit = provider.models[id];
    if (hit) return hit;
  }

  // Bare id match as suffix of "org/id" keys (openrouter)
  const openrouter = providers.openrouter;
  if (openrouter) {
    for (const [key, model] of Object.entries(openrouter.models)) {
      if (key === id || key.endsWith(`/${id}`)) return model;
    }
  }

  return null;
}

/** List models for a models.dev provider (optional substring filter). */
export function listModelsDevForProvider(
  providers: ProviderMap,
  providerId: string,
  opts?: { query?: string; limit?: number },
): Model[] {
  const bucket = providers[providerId]?.models;
  if (!bucket) return [];
  const q = opts?.query?.trim().toLowerCase() ?? "";
  const limit = opts?.limit ?? 200;
  const out: Model[] = [];
  for (const model of Object.values(bucket)) {
    if (q) {
      const hay = `${model.id} ${model.name}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    out.push(model);
    if (out.length >= limit) break;
  }
  return out;
}
