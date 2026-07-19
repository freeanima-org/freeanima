import { createHash } from "node:crypto";
import type { ModelInfo } from "@freeanima/core/provider";
import {
  REDIS_CACHE_KEY_PREFIX,
  cacheGetJson,
  cacheSetJson,
} from "@freeanima/platform/connectors/redis";

import type { OpenAiCompatibleContext } from "./context.ts";

/** Cross-process /models catalog TTL (seconds). */
export const LLM_MODEL_CATALOG_CACHE_TTL_SECONDS = 6 * 60 * 60;

export function llmModelCatalogRedisKey(context: OpenAiCompatibleContext): string {
  const digest = createHash("sha256")
    .update(`${context.baseUrl}\0${context.apiKey}`)
    .digest("hex")
    .slice(0, 32);
  return `${REDIS_CACHE_KEY_PREFIX}llm-model-catalog:${digest}`;
}

function isModelInfoArray(value: unknown): value is ModelInfo[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (entry) =>
      entry != null &&
      typeof entry === "object" &&
      typeof (entry as ModelInfo).model === "string" &&
      typeof (entry as ModelInfo).contextWindow === "number" &&
      typeof (entry as ModelInfo).maxOutputTokens === "number",
  );
}

export async function loadModelCatalogCache(
  context: OpenAiCompatibleContext,
): Promise<ModelInfo[] | null> {
  const raw = await cacheGetJson<unknown>(llmModelCatalogRedisKey(context));
  if (!isModelInfoArray(raw) || raw.length === 0) return null;
  return raw;
}

export async function saveModelCatalogCache(
  context: OpenAiCompatibleContext,
  catalog: ModelInfo[],
  ttlSeconds: number = LLM_MODEL_CATALOG_CACHE_TTL_SECONDS,
): Promise<void> {
  if (catalog.length === 0) return;
  await cacheSetJson(llmModelCatalogRedisKey(context), catalog, ttlSeconds);
}
