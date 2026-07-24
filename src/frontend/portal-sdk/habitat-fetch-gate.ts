import { getHabitatRpcConnectionState } from "./habitat-connection.ts";

export function isNetworkOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  // Bun/部分运行时存在 navigator 但无 onLine；仅 onLine === false 视为离线。
  return navigator.onLine !== false;
}

export function isHabitatConnected(): boolean {
  return getHabitatRpcConnectionState() === "connected";
}

/** 断网或 Habitat 未连接时不应发起 Habitat RPC 读请求，只读本地缓存。 */
export function isHabitatFetchAvailable(): boolean {
  return isNetworkOnline() && isHabitatConnected();
}

export function shellWritesDisabledFromState(input: {
  networkOnline: boolean;
  habitatConnection: ReturnType<typeof getHabitatRpcConnectionState>;
}): boolean {
  return !input.networkOnline || input.habitatConnection !== "connected";
}
