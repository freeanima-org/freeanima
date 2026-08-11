import { REDIS_CACHE_KEY_PREFIX, cacheGetJson, cacheSetJson } from "@freeanima/host/core/redis";
import type { ProviderMap } from "@opencode-ai/models";

/** Cross-process models.dev providers TTL (seconds). */
export const MODELS_DEV_CACHE_TTL_SECONDS = 6 * 60 * 60;

export const MODELS_DEV_REDIS_KEY = `${REDIS_CACHE_KEY_PREFIX}models-dev:providers`;

function isProviderMap(value: unknown): value is ProviderMap {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (entry) =>
      entry != null &&
      typeof entry === "object" &&
      typeof (entry as { id?: unknown }).id === "string" &&
      (entry as { models?: unknown }).models != null &&
      typeof (entry as { models: unknown }).models === "object",
  );
}

export async function loadModelsDevProvidersCache(): Promise<ProviderMap | null> {
  const raw = await cacheGetJson<unknown>(MODELS_DEV_REDIS_KEY);
  if (!isProviderMap(raw) || Object.keys(raw).length === 0) return null;
  return raw;
}

export async function saveModelsDevProvidersCache(
  providers: ProviderMap,
  ttlSeconds: number = MODELS_DEV_CACHE_TTL_SECONDS,
): Promise<void> {
  if (Object.keys(providers).length === 0) return;
  await cacheSetJson(MODELS_DEV_REDIS_KEY, providers, ttlSeconds);
}
