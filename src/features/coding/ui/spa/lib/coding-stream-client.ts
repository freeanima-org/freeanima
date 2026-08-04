/**
 * Coding 轻量流式客户端：复用 bundled RPC stream，不 import ChatApp。
 */

import {
  getBundledRpcStreamClient,
  type BundledSapStreamClient,
  type StreamApiLikeEvent,
  type SubscribeCallbacks,
} from "@freeanima/shared/rpc-contract";

export type CodingStreamClient = BundledSapStreamClient;

export function getCodingStreamClient(): CodingStreamClient {
  return getBundledRpcStreamClient();
}

export type { StreamApiLikeEvent, SubscribeCallbacks };
