import {
  reconnectHabitatRpc,
  subscribeHabitatRpcConnectionState,
  type HabitatRpcConnectionState,
} from "@freeanima/shared/habitat-rpc/bundled-browser.ts";

export type { HabitatRpcConnectionState as HabitatConnectionState };

export {
  subscribeHabitatRpcConnectionState,
  getHabitatRpcConnectionState,
  getInitialHabitatRpcConnectionStateForUi,
} from "@freeanima/shared/habitat-rpc/bundled-browser.ts";

export async function reconnectHabitat(
  opts?: Parameters<typeof reconnectHabitatRpc>[0],
): Promise<void> {
  await reconnectHabitatRpc(opts);
}

export function subscribeHabitatConnection(
  listener: (state: HabitatRpcConnectionState) => void,
): () => void {
  return subscribeHabitatRpcConnectionState(listener);
}
