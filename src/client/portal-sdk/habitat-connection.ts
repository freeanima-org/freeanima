import {
  reconnectHabitatRpc,
  subscribeHabitatRpcConnectionState,
  type HabitatRpcConnectionState,
} from "@freeanima/shared/habitat-rpc/bundled-browser.ts";

export type { HabitatRpcConnectionState as HabitatConnectionState };

export {
  subscribeHabitatRpcConnectionState,
  getHabitatRpcConnectionState,
} from "@freeanima/shared/habitat-rpc/bundled-browser.ts";

export async function reconnectHabitat(): Promise<void> {
  await reconnectHabitatRpc();
}

export function subscribeHabitatConnection(
  listener: (state: HabitatRpcConnectionState) => void,
): () => void {
  return subscribeHabitatRpcConnectionState(listener);
}
