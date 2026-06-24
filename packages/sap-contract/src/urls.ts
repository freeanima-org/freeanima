/// <reference lib="dom" />
/** Hub / relay URL helpers */

export function resolveHubHttpUrl(hubUrl: string): string {
  return hubUrl.replace(/\/$/, "");
}

export function resolveHubWsUrl(hubUrl: string): string {
  return resolveHubHttpUrl(hubUrl).replace(/^http/, "ws") + "/sap/v1";
}

export function hubHttpFromWsUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws/, "http").replace(/\/sap\/v1\/?$/, "");
}

export function resolveRelayWsUrl(origin?: string, path = "/sap/relay/v1"): string {
  const base =
    origin?.trim() ||
    (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:4173");
  const url = new URL(path, base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}
