import { getBundledHabitatRpcClient, type RpcClient } from "@freeanima/shared/habitat-rpc";

let satelliteRpc: Promise<RpcClient> | null = null;

export function whenSatelliteHubRpcReady(): Promise<RpcClient> {
  satelliteRpc ??= getBundledHabitatRpcClient().whenReady();
  return satelliteRpc;
}

export async function satelliteHubRpcCall<T>(method: string, payload?: unknown): Promise<T> {
  const rpc = await whenSatelliteHubRpcReady();
  return rpc.request<T>(method, payload);
}

export function resetSatelliteHubRpcForTests(): void {
  satelliteRpc = null;
}
