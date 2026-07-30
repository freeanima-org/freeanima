import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";

import type { PortalQueryKey } from "./keys.ts";
import { hashQueryKey } from "./keys.ts";
import { usePortalQueryClient } from "./context.tsx";

export type UsePortalReadOptions<T> = {
  queryKey: PortalQueryKey | null;
  queryFn: () => Promise<T>;
  enabled?: boolean;
};

export type UsePortalReadResult<T> = {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  refreshing: boolean;
  reload: () => Promise<void>;
  setData: (updater: T | ((prev: T | undefined) => T | undefined)) => void;
};

export function usePortalRead<T>(opts: UsePortalReadOptions<T>): UsePortalReadResult<T> {
  const client = usePortalQueryClient();
  const enabled = opts.enabled !== false && opts.queryKey != null;
  const keyHash = opts.queryKey != null ? hashQueryKey(opts.queryKey) : "";
  const queryKey = opts.queryKey;

  const [version, setVersion] = useState(0);
  const state = queryKey != null ? client.getQueryState<T>(queryKey) : null;

  const queryFnEvent = useEffectEvent(opts.queryFn);

  const reload = useCallback(async (): Promise<void> => {
    if (!enabled || queryKey == null) return;
    try {
      await client.fetchQuery({ queryKey, queryFn: () => queryFnEvent() });
    } catch {
      // error 已写入 client state
    }
  }, [client, enabled, keyHash, queryKey]);

  useEffect(() => {
    if (!enabled || queryKey == null) return;
    return client.subscribe(queryKey, () => setVersion((v) => v + 1));
  }, [client, enabled, keyHash, queryKey]);

  const lastFetchedHash = useRef<string>("");
  const lastUpdatedAt = useRef<number>(-1);

  useEffect(() => {
    if (!enabled || queryKey == null) return;
    const current = client.getQueryState<T>(queryKey);
    const needsFetch =
      lastFetchedHash.current !== keyHash ||
      current.updatedAt === 0 ||
      (current.status === "idle" && current.data === undefined);
    if (!needsFetch && current.updatedAt === lastUpdatedAt.current) return;
    lastFetchedHash.current = keyHash;
    lastUpdatedAt.current = current.updatedAt === 0 ? -1 : current.updatedAt;
    void reload();
  }, [client, enabled, keyHash, queryKey, version, state?.updatedAt, reload]);

  const setData = useCallback(
    (updater: T | ((prev: T | undefined) => T | undefined)) => {
      if (queryKey == null) return;
      client.setQueryData<T>(queryKey, updater);
    },
    [client, queryKey],
  );

  const data = state?.data;
  const error = state?.error ?? null;
  const pending = state?.status === "pending" || state?.status === "idle";

  return {
    data,
    error,
    loading: Boolean(enabled && data === undefined && pending && error == null),
    refreshing: Boolean(enabled && data !== undefined && state?.status === "pending"),
    reload,
    setData,
  };
}
