/// <reference lib="dom" />

export function resolveHubHttpUrl(hubUrl: string): string {
  return hubUrl.replace(/\/$/, "");
}

export function resolveHubRpcWsUrl(hubUrl: string): string {
  return resolveHubHttpUrl(hubUrl).replace(/^http/, "ws") + "/hub/rpc/v1";
}

export function hubHttpFromRpcWsUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws/, "http").replace(/\/hub\/rpc\/v1\/?$/, "");
}
