import { isHubFetchAvailable } from "./hub-fetch-gate.ts";
import { readOfflineCache, writeOfflineCache } from "./offline-cache.ts";

export type WithOfflineCacheOptions<T> = {
  scope: string;
  namespace: string;
  id: string;
  fetch: () => Promise<T>;
  offlineError?: string;
  /**
   * 写回缓存前对服务器结果做一次协调。可写模块用它把 outbox 中仍未同步的本地条目
   * 合并进服务器快照，避免刷新时把 temp 条目从缓存里覆盖丢失。
   */
  reconcile?: (fresh: T) => T | Promise<T>;
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
    const next = opts.reconcile ? await opts.reconcile(fresh) : fresh;
    void writeOfflineCache(opts.scope, opts.namespace, opts.id, next);
    return next;
  } catch {
    if (cached != null) return cached;
    throw new Error(opts.offlineError ?? "offline fetch failed");
  }
}
