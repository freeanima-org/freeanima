import { getHubRpcConnectionState } from "./hub-connection.ts";

export function isNetworkOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  // Bun/部分运行时存在 navigator 但无 onLine；仅 onLine === false 视为离线。
  return navigator.onLine !== false;
}

export function isHubConnected(): boolean {
  return getHubRpcConnectionState() === "connected";
}

/** 断网或 Hub 未连接时不应发起 Hub RPC 读请求，只读本地缓存。 */
export function isHubFetchAvailable(): boolean {
  return isNetworkOnline() && isHubConnected();
}

export function shellWritesDisabledFromState(input: {
  networkOnline: boolean;
  hubConnection: ReturnType<typeof getHubRpcConnectionState>;
}): boolean {
  return !input.networkOnline || input.hubConnection !== "connected";
}
