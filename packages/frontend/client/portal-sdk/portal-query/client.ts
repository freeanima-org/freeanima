import { hashQueryKey, type PortalQueryKey } from "./keys.ts";

export type PortalQueryState<T = unknown> = {
  data: T | undefined;
  error: Error | null;
  status: "idle" | "pending" | "success" | "error";
  /** 0 表示已 invalidate，订阅方应 refetch */
  updatedAt: number;
};

type Listener = () => void;

type CacheEntry = {
  queryKey: PortalQueryKey;
  state: PortalQueryState;
  promise: Promise<unknown> | null;
  listeners: Set<Listener>;
};

function idleState<T>(): PortalQueryState<T> {
  return { data: undefined, error: null, status: "idle", updatedAt: 0 };
}

export type FetchQueryOptions<T> = {
  queryKey: PortalQueryKey;
  queryFn: () => Promise<T>;
};

export type InvalidateFilter =
  | PortalQueryKey
  | ((queryKey: PortalQueryKey, hashedKey: string) => boolean);

function matchesFilter(
  queryKey: PortalQueryKey,
  hashed: string,
  filter: InvalidateFilter,
): boolean {
  if (typeof filter === "function") return filter(queryKey, hashed);
  if (typeof filter === "string") {
    return hashed === filter || (typeof queryKey === "string" && queryKey === filter);
  }
  if (typeof queryKey === "string") return false;
  if (filter.length === 0) return true;
  if (queryKey.length < filter.length) return false;
  for (let i = 0; i < filter.length; i++) {
    if (JSON.stringify(queryKey[i]) !== JSON.stringify(filter[i])) return false;
  }
  return true;
}

/**
 * 自研 Portal query 内存层（非 TanStack）。
 * 无 focus refetch / 无全局 polling；由 key 变化、reload、invalidate 驱动。
 */
export class PortalQueryClient {
  private readonly cache = new Map<string, CacheEntry>();

  getQueryState<T>(queryKey: PortalQueryKey): PortalQueryState<T> {
    const entry = this.cache.get(hashQueryKey(queryKey));
    return (entry?.state as PortalQueryState<T> | undefined) ?? idleState<T>();
  }

  getQueryData(queryKey: PortalQueryKey): unknown {
    return this.getQueryState(queryKey).data;
  }

  setQueryData<T>(
    queryKey: PortalQueryKey,
    updater: T | ((prev: T | undefined) => T | undefined),
  ): void {
    const hashed = hashQueryKey(queryKey);
    const entry = this.ensureEntry(hashed, queryKey);
    const prev = entry.state.data as T | undefined;
    const next =
      typeof updater === "function"
        ? (updater as (p: T | undefined) => T | undefined)(prev)
        : updater;
    entry.state = {
      data: next,
      error: null,
      status: "success",
      updatedAt: Date.now(),
    };
    this.notify(entry);
  }

  subscribe(queryKey: PortalQueryKey, listener: Listener): () => void {
    const hashed = hashQueryKey(queryKey);
    const entry = this.ensureEntry(hashed, queryKey);
    entry.listeners.add(listener);
    return () => {
      entry.listeners.delete(listener);
    };
  }

  async fetchQuery<T>(opts: FetchQueryOptions<T>): Promise<T> {
    const hashed = hashQueryKey(opts.queryKey);
    const entry = this.ensureEntry(hashed, opts.queryKey);

    if (entry.promise) {
      return entry.promise as Promise<T>;
    }

    entry.state = {
      ...entry.state,
      status: entry.state.data === undefined ? "pending" : entry.state.status,
      error: null,
    };
    this.notify(entry);

    const promise = (async () => {
      try {
        const data = await opts.queryFn();
        entry.state = {
          data,
          error: null,
          status: "success",
          updatedAt: Date.now(),
        };
        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        entry.state = {
          ...entry.state,
          error,
          status: "error",
          updatedAt: Date.now(),
        };
        throw error;
      } finally {
        entry.promise = null;
        this.notify(entry);
      }
    })();

    entry.promise = promise;
    return promise;
  }

  async invalidateQueries(filter: InvalidateFilter): Promise<void> {
    for (const [hashed, entry] of this.cache.entries()) {
      if (!matchesFilter(entry.queryKey, hashed, filter)) continue;
      entry.state = { ...entry.state, updatedAt: 0 };
      this.notify(entry);
    }
  }

  /** 清空全部内存 cache（测试用）。 */
  clear(): void {
    for (const entry of this.cache.values()) {
      entry.promise = null;
      entry.state = idleState();
      this.notify(entry);
    }
    this.cache.clear();
  }

  private ensureEntry(hashed: string, queryKey: PortalQueryKey): CacheEntry {
    let entry = this.cache.get(hashed);
    if (!entry) {
      entry = { queryKey, state: idleState(), promise: null, listeners: new Set() };
      this.cache.set(hashed, entry);
    }
    return entry;
  }

  private notify(entry: CacheEntry): void {
    for (const listener of entry.listeners) {
      listener();
    }
  }
}

let defaultClient: PortalQueryClient | null = null;

export function getDefaultPortalQueryClient(): PortalQueryClient {
  if (!defaultClient) defaultClient = new PortalQueryClient();
  return defaultClient;
}

export function resetDefaultPortalQueryClientForTest(): void {
  defaultClient?.clear();
  defaultClient = null;
}
