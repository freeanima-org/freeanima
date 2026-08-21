import { REDIS_CACHE_KEY_PREFIX, cacheGetJson, cacheSetJson } from "@freeanima/habitat/core/redis";
import type { ProviderMap } from "@opencode-ai/models";
import { asRecord } from "@freeanima/shared/util";

/** Cross-process models.dev providers TTL (seconds). */
export const MODELS_DEV_CACHE_TTL_SECONDS = 6 * 60 * 60;

export const MODELS_DEV_REDIS_KEY = `${REDIS_CACHE_KEY_PREFIX}models-dev:providers`;

function isProviderMap(value: unknown): value is ProviderMap {
  const root = asRecord(value);
  if (!root) return false;
  return Object.values(root).every((entry) => {
    const rec = asRecord(entry);
    return rec != null && typeof rec.id === "string" && asRecord(rec.models) != null;
  });
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
