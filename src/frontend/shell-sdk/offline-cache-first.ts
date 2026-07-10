import { isHubFetchAvailable } from "./hub-fetch-gate.ts";
import { readOfflineCache, writeOfflineCache } from "./offline-cache.ts";

export type WithOfflineCacheOptions<T> = {
  scope: string;
  namespace: string;
  id: string;
  fetch: () => Promise<T>;
  offlineError?: string;
};

/** Tier 1 cache-first：Hub 可用时 refresh；断连时只读快照、不发起 RPC。 */
export async function withOfflineCache<T>(opts: WithOfflineCacheOptions<T>): Promise<T> {
  const cached = await readOfflineCache<T>(opts.scope, opts.namespace, opts.id);
  if (!isHubFetchAvailable()) {
    if (cached != null) return cached;
    throw new Error(opts.offlineError ?? "offline fetch failed");
  }
  try {
    const fresh = await opts.fetch();
    void writeOfflineCache(opts.scope, opts.namespace, opts.id, fresh);
    return fresh;
  } catch {
    if (cached != null) return cached;
    throw new Error(opts.offlineError ?? "offline fetch failed");
  }
}
