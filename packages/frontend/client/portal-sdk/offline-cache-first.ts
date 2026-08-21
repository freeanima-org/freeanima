import { isHabitatFetchAvailable } from "./habitat-fetch-gate.ts";
import {
  isRecordableTransportFailure,
  recordHabitatTransportFailure,
  recordHabitatTransportSuccess,
} from "./local-prefer.ts";
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

/**
 * 在线栖息地优先 / 离线 cache：
 * - 栖息地可用：先发 fetch（可与 IDB 读并行，缓存仅作失败回退）；成功后异步写回缓存
 * - 栖息地不可用：只读本地快照，不发起 RPC
 */
export async function withOfflineCache<T>(opts: WithOfflineCacheOptions<T>): Promise<T> {
  if (!isHabitatFetchAvailable()) {
    const cached = await readOfflineCache<T>(opts.scope, opts.namespace, opts.id);
    if (cached != null) return cached;
    throw new Error(opts.offlineError ?? "offline fetch failed");
  }

  const cachedPromise = readOfflineCache<T>(opts.scope, opts.namespace, opts.id);
  try {
    const fresh = await opts.fetch();
    recordHabitatTransportSuccess();
    const next = opts.reconcile ? await opts.reconcile(fresh) : fresh;
    void writeOfflineCache(opts.scope, opts.namespace, opts.id, next);
    return next;
  } catch (err) {
    if (isRecordableTransportFailure(err)) {
      recordHabitatTransportFailure();
    }
    const cached = await cachedPromise;
    if (cached != null) return cached;
    throw err;
  }
}
