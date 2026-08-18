import { getHabitatRpcConnectionState } from "./habitat-connection.ts";
import { isLocalPreferActive } from "./local-prefer.ts";

export function isNetworkOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  // Bun 等运行时可能缺 onLine（undefined）；仅显式 false 视为离线。
  // oxlint-disable-next-line typescript/no-unnecessary-boolean-literal-compare -- 运行时 onLine 可为 undefined，不能写成 !navigator.onLine
  return navigator.onLine !== false;
}

export function isHabitatConnected(): boolean {
  return getHabitatRpcConnectionState() === "connected";
}

/**
 * 断网、Habitat 未连接、或弱网本地优先时不应发起 Habitat RPC 读/flush，只读本地缓存。
 */
export function isHabitatFetchAvailable(): boolean {
  return isNetworkOnline() && isHabitatConnected() && !isLocalPreferActive();
}

export function shellWritesDisabledFromState(input: {
  networkOnline: boolean;
  habitatConnection: ReturnType<typeof getHabitatRpcConnectionState>;
}): boolean {
  return !input.networkOnline || input.habitatConnection !== "connected";
}
