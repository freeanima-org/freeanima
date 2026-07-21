import { getBundledHabitatRpcClient, type RpcClient } from "@freeanima/shared/habitat-rpc";

let satelliteRpc: Promise<RpcClient> | null = null;

export function whenSatelliteHabitatRpcReady(): Promise<RpcClient> {
  satelliteRpc ??= getBundledHabitatRpcClient().whenReady();
  return satelliteRpc;
}

/** @deprecated 使用 {@link whenSatelliteHabitatRpcReady} */
export const whenSatelliteHubRpcReady = whenSatelliteHabitatRpcReady;

export async function satelliteHabitatRpcCall<T>(method: string, payload?: unknown): Promise<T> {
  const rpc = await whenSatelliteHabitatRpcReady();
  return rpc.request<T>(method, payload);
}

/** @deprecated 使用 {@link satelliteHabitatRpcCall} */
export const satelliteHubRpcCall = satelliteHabitatRpcCall;

export function resetSatelliteHabitatRpcForTests(): void {
  satelliteRpc = null;
}

/** @deprecated 使用 {@link resetSatelliteHabitatRpcForTests} */
export const resetSatelliteHubRpcForTests = resetSatelliteHabitatRpcForTests;
