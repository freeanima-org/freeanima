/// <reference lib="dom" />

/** 栖息地 RPC REST/WS 权威前缀 */
export const HABITAT_RPC_REST_PREFIX = "/rpc/v1";

export function habitatRpcRestPrefix(): string {
  return HABITAT_RPC_REST_PREFIX;
}

/** 是否 Habitat RPC 路径 */
export function isHabitatRpcPathname(pathname: string): boolean {
  return pathname === HABITAT_RPC_REST_PREFIX || pathname.startsWith(`${HABITAT_RPC_REST_PREFIX}/`);
}

function normalizeOrigin(httpOrigin: string): string {
  return httpOrigin.replace(/\/$/, "");
}

/** 无 token 探活 URL */
export function habitatHealthProbeUrl(httpOrigin: string): string {
  return `${normalizeOrigin(httpOrigin)}${HABITAT_RPC_REST_PREFIX}/health/probe`;
}

export function resolveHabitatHttpUrl(habitatUrl: string): string {
  return habitatUrl.replace(/\/$/, "");
}

export function resolveHabitatRpcWsUrl(habitatUrl: string): string {
  return resolveHabitatHttpUrl(habitatUrl).replace(/^http/, "ws") + HABITAT_RPC_REST_PREFIX;
}

export function habitatHttpFromRpcWsUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws/, "http").replace(new RegExp(`${HABITAT_RPC_REST_PREFIX}/?$`), "");
}
