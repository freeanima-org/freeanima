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
 * 是否值得尝试 Habitat 读/写（HTTP 或等 WS）。
 * `connecting` 仍算可达：只读默认走 HTTP REST，与实时 WS 条幅状态独立；
 * 仅 `disconnected`（或离线 / localPrefer）才纯吃缓存。
 */
export function isHabitatRpcReachableForFetch(): boolean {
  const state = getHabitatRpcConnectionState();
  return state === "connected" || state === "connecting";
}

/**
 * 断网、Habitat 已判定断开、或弱网本地优先时不应发起 Habitat RPC 读/flush，只读本地缓存。
 */
export function isHabitatFetchAvailable(): boolean {
  // bundled-browser RPC 依赖 window（portalShell / WS）；Bun 单测无 DOM 时不应走 online 写穿。
  if (typeof window === "undefined") return false;
  return isNetworkOnline() && isHabitatRpcReachableForFetch() && !isLocalPreferActive();
}

export function shellWritesDisabledFromState(input: {
  networkOnline: boolean;
  habitatConnection: ReturnType<typeof getHabitatRpcConnectionState>;
}): boolean {
  return !input.networkOnline || input.habitatConnection !== "connected";
}
