/// <reference lib="dom" />
import {
  getBundledHabitatRpcClient,
  subscribeBundledHabitatRpcConfigChanges,
  type HabitatRpcConnectionState,
} from "@freeanima/shared/habitat-rpc";
import type { StreamApiLikeEvent } from "./frames/message.ts";
import {
  createSapConversationStreamClient,
  type SubscribeCallbacks,
} from "./conversation-stream-core.ts";
import { sapClientFromRpc } from "./rpc-stream-client-from-rpc.ts";
import type { RpcStreamClient } from "./router.ts";

export type SapConnectionState = HabitatRpcConnectionState;

export type BundledSapStreamClient = {
  whenReady(): Promise<RpcStreamClient>;
  getClient(): RpcStreamClient | null;
  stop(): void;
  subscribeConversationEvents(
    conversationId: string,
    onUpdate: () => void,
  ): { unsubscribe: () => void };
  subscribeInboxEvents(onUpdate: (conversationId: string) => void): { unsubscribe: () => void };
  sendMessageStream(
    input: { conversationId: string; message: string },
    callbacks: SubscribeCallbacks<StreamApiLikeEvent>,
  ): { unsubscribe: () => void };
  resumeMessageStream(
    streamId: string,
    callbacks: SubscribeCallbacks<StreamApiLikeEvent>,
  ): { unsubscribe: () => void };
};

let bundledClient: BundledSapStreamClient | null = null;

export function createBundledSapStreamClient(options?: {
  hubRpcWsUrl?: string;
  habitatUrl?: string;
  authToken?: string;
  onConnectionStateChange?: (state: SapConnectionState) => void;
}): BundledSapStreamClient {
  const hubRpc = getBundledHabitatRpcClient({
    ...(options?.hubRpcWsUrl !== undefined ? { hubRpcWsUrl: options.hubRpcWsUrl } : {}),
    ...(options?.habitatUrl !== undefined ? { habitatUrl: options.habitatUrl } : {}),
    ...(options?.authToken !== undefined ? { authToken: options.authToken } : {}),
    ...(options?.onConnectionStateChange !== undefined
      ? { onConnectionStateChange: options.onConnectionStateChange }
      : {}),
  });

  const whenSap = async (): Promise<RpcStreamClient> => {
    const rpc = await hubRpc.whenReady();
    return sapClientFromRpc(rpc);
  };

  const stream = createSapConversationStreamClient(whenSap);

  return {
    whenReady: whenSap,
    getClient(): RpcStreamClient | null {
      const rpc = hubRpc.getClient();
      return rpc ? sapClientFromRpc(rpc) : null;
    },
    stop(): void {
      stream.detach();
      hubRpc.stop();
    },
    subscribeConversationEvents: stream.subscribeConversationEvents.bind(stream),
    subscribeInboxEvents: stream.subscribeInboxEvents.bind(stream),
    sendMessageStream: stream.sendMessageStream.bind(stream),
    resumeMessageStream: stream.resumeMessageStream.bind(stream),
  };
}

export function getBundledRpcStreamClient(
  options?: Parameters<typeof createBundledSapStreamClient>[0],
): BundledSapStreamClient {
  if (!bundledClient) {
    bundledClient = createBundledSapStreamClient(options);
  }
  return bundledClient;
}

export async function whenBundledRpcStreamClientReady(): Promise<RpcStreamClient> {
  return getBundledRpcStreamClient().whenReady();
}

export async function whenBundledRpcClientReady(): Promise<RpcStreamClient> {
  return whenBundledRpcStreamClientReady();
}

export function resetBundledRpcStreamClientForTests(): void {
  bundledClient?.stop();
  bundledClient = null;
}

export { subscribeBundledHabitatRpcConfigChanges as subscribeShellConfigChanges };
