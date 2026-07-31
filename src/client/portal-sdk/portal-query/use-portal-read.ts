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
  // 调用方常写内联数组 key；用 ref 避免 reload 引用随 key 身份抖动
  const queryKeyRef = useRef(queryKey);
  queryKeyRef.current = queryKey;

  const [version, setVersion] = useState(0);
  const state = queryKey != null ? client.getQueryState<T>(queryKey) : null;

  const queryFnEvent = useEffectEvent(opts.queryFn);

  const reload = useCallback(async (): Promise<void> => {
    const key = queryKeyRef.current;
    if (!enabled || key == null) return;
    try {
      await client.fetchQuery({ queryKey: key, queryFn: () => queryFnEvent() });
    } catch {
      // error 已写入 client state
    }
  }, [client, enabled, keyHash]);

  useEffect(() => {
    if (!enabled || queryKey == null) return;
    return client.subscribe(queryKey, () => setVersion((v) => v + 1));
    // keyHash 代表 queryKey 内容；勿依赖 queryKey 引用身份
  }, [client, enabled, keyHash]);

  const lastFetchedHash = useRef<string>("");

  useEffect(() => {
    if (!enabled || queryKey == null) return;
    const current = client.getQueryState<T>(queryKey);
    // updatedAt===0：未拉取或已 invalidate。成功后 updatedAt 为时间戳，不得因此再 reload
    //（否则会与 notify 形成「成功 → updatedAt 变化 → 再拉」死循环）。
    const needsFetch =
      lastFetchedHash.current !== keyHash ||
      current.updatedAt === 0 ||
      (current.status === "idle" && current.data === undefined);
    if (!needsFetch) return;
    lastFetchedHash.current = keyHash;
    void reload();
  }, [client, enabled, keyHash, version, state?.updatedAt, reload]);

  const setData = useCallback(
    (updater: T | ((prev: T | undefined) => T | undefined)) => {
      const key = queryKeyRef.current;
      if (key == null) return;
      client.setQueryData<T>(key, updater);
    },
    [client, keyHash],
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
