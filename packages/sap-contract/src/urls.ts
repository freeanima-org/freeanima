export { resolveHubHttpUrl, resolveHubRpcWsUrl, hubHttpFromRpcWsUrl } from "@freeanima/hub-rpc";

import { resolveHubRpcWsUrl, hubHttpFromRpcWsUrl } from "@freeanima/hub-rpc";

/** @deprecated 使用 resolveHubRpcWsUrl */
export function resolveHubWsUrl(hubUrl: string): string {
  return resolveHubRpcWsUrl(hubUrl);
}

/** @deprecated 使用 hubHttpFromRpcWsUrl */
export function hubHttpFromWsUrl(wsUrl: string): string {
  return hubHttpFromRpcWsUrl(wsUrl);
}

export function resolveRelayWsUrl(origin?: string, path = "/sap/relay/v1"): string {
  const base =
    origin?.trim() ||
    (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:4173");
  const url = new URL(path, base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}
