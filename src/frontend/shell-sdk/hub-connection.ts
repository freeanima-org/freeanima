import {
  reconnectHubRpc,
  subscribeHubRpcConnectionState,
  type HubRpcConnectionState,
} from "@freeanima/hub-rpc";

export type { HubRpcConnectionState as HubConnectionState };

export { subscribeHubRpcConnectionState, getHubRpcConnectionState } from "@freeanima/hub-rpc";

export async function reconnectHub(): Promise<void> {
  await reconnectHubRpc();
}

export function subscribeHubConnection(
  listener: (state: HubRpcConnectionState) => void,
): () => void {
  return subscribeHubRpcConnectionState(listener);
}
