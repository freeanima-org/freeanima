export {
  resolveHabitatHttpUrl,
  resolveHabitatRpcWsUrl,
  habitatHttpFromRpcWsUrl,
} from "@freeanima/shared/habitat-rpc";

import { resolveHabitatRpcWsUrl, habitatHttpFromRpcWsUrl } from "@freeanima/shared/habitat-rpc";

/** @deprecated 使用 resolveHabitatRpcWsUrl */
export function resolveHubWsUrl(habitatUrl: string): string {
  return resolveHabitatRpcWsUrl(habitatUrl);
}

/** @deprecated 使用 habitatHttpFromRpcWsUrl */
export function habitatHttpFromWsUrl(wsUrl: string): string {
  return habitatHttpFromRpcWsUrl(wsUrl);
}

export function resolveRelayWsUrl(origin?: string, path = "/sap/relay/v1"): string {
  const base =
    origin?.trim() ||
    (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:4173");
  const url = new URL(path, base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}
