import { Models, type ProviderMap } from "@opencode-ai/models";
import { loadModelsDevProvidersCache, saveModelsDevProvidersCache } from "./cache.ts";

let memoryCache: ProviderMap | null = null;
let memoryCacheAt = 0;
const MEMORY_TTL_MS = 6 * 60 * 60 * 1000;

/** Load models.dev provider map: memory → Redis → network → snapshot. */
export async function loadModelsDevProviders(opts?: {
  signal?: AbortSignal;
  /** Force skip memory cache (still may hit Redis / network). */
  bypassMemory?: boolean;
}): Promise<ProviderMap> {
  const now = Date.now();
  if (!opts?.bypassMemory && memoryCache && now - memoryCacheAt < MEMORY_TTL_MS) {
    return memoryCache;
  }

  const fromRedis = await loadModelsDevProvidersCache();
  if (fromRedis) {
    memoryCache = fromRedis;
    memoryCacheAt = now;
    return fromRedis;
  }

  try {
    const client = Models.make();
    const providers = await client.providers({
      signal: opts?.signal ?? AbortSignal.timeout(8_000),
    });
    memoryCache = providers;
    memoryCacheAt = now;
    await saveModelsDevProvidersCache(providers);
    return providers;
  } catch {
    const snapshot = await import("@opencode-ai/models/snapshot");
    memoryCache = snapshot.providers;
    memoryCacheAt = now;
    await saveModelsDevProvidersCache(snapshot.providers);
    return snapshot.providers;
  }
}

/** Test helper: clear in-process cache. */
export function clearModelsDevMemoryCache(): void {
  memoryCache = null;
  memoryCacheAt = 0;
}
