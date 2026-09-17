import {
  getBundledHabitatRpcClient,
  type RpcClient,
} from "@freeanima/shared/habitat-rpc/bundled-browser.ts";

let satelliteRpc: Promise<RpcClient> | null = null;

export function whenPortalHabitatRpcReady(): Promise<RpcClient> {
  satelliteRpc ??= getBundledHabitatRpcClient().whenReady();
  return satelliteRpc;
}

export async function portalHabitatRpcCall<T>(method: string, payload?: unknown): Promise<T> {
  const rpc = await whenPortalHabitatRpcReady();
  return rpc.request<T>(method, payload);
}

export function resetSatelliteHabitatRpcForTests(): void {
  satelliteRpc = null;
}
