import type { RpcClient, RpcRequestOptions } from "@freeanima/shared/habitat-rpc";
import type { RpcStreamClient, RpcMethod, RpcRouterInputs, RpcRouterOutputs } from "./router.ts";

export function sapClientFromRpc(rpc: RpcClient): RpcStreamClient {
  return {
    request<K extends RpcMethod>(
      method: K,
      payload: RpcRouterInputs[K],
      opts?: RpcRequestOptions,
    ): Promise<RpcRouterOutputs[K]> {
      return rpc.request(method, payload, opts) as Promise<RpcRouterOutputs[K]>;
    },
    onEvent(method: string, handler: (payload: unknown) => void): () => void {
      return rpc.onEvent(method, handler);
    },
    close(): void {
      rpc.close();
    },
  };
}
