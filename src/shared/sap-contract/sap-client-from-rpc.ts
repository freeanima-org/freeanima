import type { RpcClient, RpcRequestOptions } from "@freeanima/shared/habitat-rpc";
import type { SapClient, SapMethod, SapRouterInputs, SapRouterOutputs } from "./router.ts";

export function sapClientFromRpc(rpc: RpcClient): SapClient {
  return {
    request<K extends SapMethod>(
      method: K,
      payload: SapRouterInputs[K],
      opts?: RpcRequestOptions,
    ): Promise<SapRouterOutputs[K]> {
      return rpc.request(method, payload, opts) as Promise<SapRouterOutputs[K]>;
    },
    onEvent(method: string, handler: (payload: unknown) => void): () => void {
      return rpc.onEvent(method, handler);
    },
    close(): void {
      rpc.close();
    },
  };
}
