import { getBundledHubRpcClient, type RpcClient } from "@freeanima/shared/hub-rpc";

let satelliteRpc: Promise<RpcClient> | null = null;

export function whenSatelliteHubRpcReady(): Promise<RpcClient> {
  satelliteRpc ??= getBundledHubRpcClient().whenReady();
  return satelliteRpc;
}

export async function satelliteHubRpcCall<T>(method: string, payload?: unknown): Promise<T> {
  const rpc = await whenSatelliteHubRpcReady();
  return rpc.request<T>(method, payload);
}

export function resetSatelliteHubRpcForTests(): void {
  satelliteRpc = null;
}
