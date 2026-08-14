import { useState } from "react";

import type { PortalQueryKey } from "./keys.ts";
import { usePortalQueryClient } from "./context.tsx";

export type UsePortalMutationOptions<TData, TVariables> = {
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** 成功后 invalidate 的 key 前缀列表 */
  invalidateKeys?: PortalQueryKey[];
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: Error, variables: TVariables) => void;
};

export type UsePortalMutationResult<TData, TVariables> = {
  mutate: (variables: TVariables) => Promise<TData>;
  data: TData | undefined;
  error: Error | null;
  pending: boolean;
  reset: () => void;
};

export function usePortalMutation<TData, TVariables>(
  opts: UsePortalMutationOptions<TData, TVariables>,
): UsePortalMutationResult<TData, TVariables> {
  const client = usePortalQueryClient();
  const [data, setData] = useState<TData | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);

  const mutate = async (variables: TVariables): Promise<TData> => {
    setPending(true);
    setError(null);
    try {
      const result = await opts.mutationFn(variables);
      setData(result);
      if (opts.invalidateKeys) {
        for (const key of opts.invalidateKeys) {
          await client.invalidateQueries(key);
        }
      }
      await opts.onSuccess?.(result, variables);
      return result;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      opts.onError?.(errorObj, variables);
      throw errorObj;
    } finally {
      setPending(false);
    }
  };

  return {
    mutate,
    data,
    error,
    pending,
    reset: () => {
      setData(undefined);
      setError(null);
      setPending(false);
    },
  };
}
