/// <reference lib="dom" />

export const HUB_RPC_REST_PREFIX = "/hub/rpc/v1";

export function hubRpcRestPrefix(): string {
  return HUB_RPC_REST_PREFIX;
}

function normalizeOrigin(httpOrigin: string): string {
  return httpOrigin.replace(/\/$/, "");
}

/** 无 token 探活 URL */
export function hubHealthProbeUrl(httpOrigin: string): string {
  return `${normalizeOrigin(httpOrigin)}${HUB_RPC_REST_PREFIX}/health/probe`;
}

export function resolveHubHttpUrl(hubUrl: string): string {
  return hubUrl.replace(/\/$/, "");
}

export function resolveHubRpcWsUrl(hubUrl: string): string {
  return resolveHubHttpUrl(hubUrl).replace(/^http/, "ws") + "/hub/rpc/v1";
}

export function hubHttpFromRpcWsUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws/, "http").replace(/\/hub\/rpc\/v1\/?$/, "");
}
