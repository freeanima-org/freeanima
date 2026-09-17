import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";

import type { PortalQueryKey } from "./keys.ts";
import { hashQueryKey } from "./keys.ts";
import { usePortalQueryClient } from "./context.tsx";

export type InfiniteData<TPage> = {
  pages: TPage[];
  pageParams: unknown[];
};

export type UsePortalInfiniteQueryOptions<TPage> = {
  queryKey: PortalQueryKey | null;
  /** 拉取一页；pageParam 首屏为 initialPageParam */
  queryFn: (ctx: { pageParam: unknown }) => Promise<TPage>;
  initialPageParam?: unknown;
  getNextPageParam: (lastPage: TPage, pages: TPage[]) => unknown;
  enabled?: boolean;
};

export type UsePortalInfiniteQueryResult<TPage> = {
  data: InfiniteData<TPage> | undefined;
  error: Error | null;
  loading: boolean;
  loadingMore: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => Promise<void>;
  reload: () => Promise<void>;
  setData: (
    updater:
      | InfiniteData<TPage>
      | ((prev: InfiniteData<TPage> | undefined) => InfiniteData<TPage> | undefined),
  ) => void;
};

export function usePortalInfiniteQuery<TPage>(
  opts: UsePortalInfiniteQueryOptions<TPage>,
): UsePortalInfiniteQueryResult<TPage> {
  const client = usePortalQueryClient();
  const enabled = opts.enabled !== false && opts.queryKey != null;
  const keyHash = opts.queryKey != null ? hashQueryKey(opts.queryKey) : "";
  const queryKey = opts.queryKey;
  const queryKeyRef = useRef(queryKey);
  queryKeyRef.current = queryKey;
  const initialPageParam = opts.initialPageParam ?? 0;

  const [version, setVersion] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const state = queryKey != null ? client.getQueryState<InfiniteData<TPage>>(queryKey) : null;

  const queryFnEvent = useEffectEvent(opts.queryFn);

  const loadFirstPage = useCallback(async (): Promise<void> => {
    const key = queryKeyRef.current;
    if (!enabled || key == null) return;
    try {
      await client.fetchQuery({
        queryKey: key,
        queryFn: async () => {
          const page = await queryFnEvent({ pageParam: initialPageParam });
          return { pages: [page], pageParams: [initialPageParam] } satisfies InfiniteData<TPage>;
        },
      });
    } catch {
      // error in client state
    }
  }, [client, enabled, initialPageParam, keyHash]);

  useEffect(() => {
    if (!enabled || queryKey == null) return () => {};
    return client.subscribe(queryKey, () => setVersion((v) => v + 1));
  }, [client, enabled, keyHash]);

  const lastFetchedHash = useRef<string>("");

  useEffect(() => {
    if (!enabled || queryKey == null) return;
    const current = client.getQueryState<InfiniteData<TPage>>(queryKey);
    const needsFetch =
      lastFetchedHash.current !== keyHash ||
      current.updatedAt === 0 ||
      (current.status === "idle" && current.data === undefined);
    if (!needsFetch) return;
    lastFetchedHash.current = keyHash;
    void loadFirstPage();
  }, [client, enabled, keyHash, version, state?.updatedAt, loadFirstPage]);

  const data = state?.data;
  const lastPage = data?.pages[data.pages.length - 1];
  const nextParam =
    lastPage != null && data != null ? opts.getNextPageParam(lastPage, data.pages) : undefined;
  const hasNextPage = nextParam != null && nextParam !== false;

  const fetchNextPage = useCallback(async (): Promise<void> => {
    const key = queryKeyRef.current;
    if (!enabled || key == null || !hasNextPage || loadingMore) return;
    const pageParam = nextParam;
    setLoadingMore(true);
    try {
      const page = await queryFnEvent({ pageParam });
      client.setQueryData<InfiniteData<TPage>>(key, (prev) => {
        const base = prev ?? { pages: [], pageParams: [] };
        return {
          pages: [...base.pages, page],
          pageParams: [...base.pageParams, pageParam],
        };
      });
    } finally {
      setLoadingMore(false);
    }
  }, [client, enabled, hasNextPage, loadingMore, nextParam, keyHash]);

  const setData = useCallback(
    (
      updater:
        | InfiniteData<TPage>
        | ((prev: InfiniteData<TPage> | undefined) => InfiniteData<TPage> | undefined),
    ) => {
      const key = queryKeyRef.current;
      if (key == null) return;
      client.setQueryData<InfiniteData<TPage>>(key, updater);
    },
    [client, keyHash],
  );

  return {
    data,
    error: state?.error ?? null,
    loading:
      enabled && data === undefined && (state?.status === "pending" || state?.status === "idle"),
    loadingMore,
    hasNextPage: hasNextPage,
    fetchNextPage,
    reload: loadFirstPage,
    setData,
  };
}
