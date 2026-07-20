/// <reference lib="dom" />

/** 栖息地 RPC REST/WS 权威前缀 */
export const HABITAT_RPC_REST_PREFIX = "/rpc/v1";

/**
 * 旧前缀（仅兼容）。HTTP 请求 302 → {@link HABITAT_RPC_REST_PREFIX}；WS 双挂。
 * @deprecated 0.9.4 删除
 */
export const HABITAT_RPC_REST_PREFIX_LEGACY = "/hub/rpc/v1";

export function habitatRpcRestPrefix(): string {
  return HABITAT_RPC_REST_PREFIX;
}

/** 是否权威或 legacy RPC 路径（legacy 于 0.9.4 删除） */
export function isHabitatRpcPathname(pathname: string): boolean {
  return (
    pathname === HABITAT_RPC_REST_PREFIX ||
    pathname.startsWith(`${HABITAT_RPC_REST_PREFIX}/`) ||
    pathname === HABITAT_RPC_REST_PREFIX_LEGACY ||
    pathname.startsWith(`${HABITAT_RPC_REST_PREFIX_LEGACY}/`)
  );
}

/** legacy HTTP → 权威路径的 Location（含 query）；非 legacy 返回 null */
export function legacyRpcRedirectLocation(url: URL): string | null {
  const { pathname, search } = url;
  if (pathname === HABITAT_RPC_REST_PREFIX_LEGACY) {
    return `${HABITAT_RPC_REST_PREFIX}${search}`;
  }
  if (pathname.startsWith(`${HABITAT_RPC_REST_PREFIX_LEGACY}/`)) {
    return `${HABITAT_RPC_REST_PREFIX}${pathname.slice(HABITAT_RPC_REST_PREFIX_LEGACY.length)}${search}`;
  }
  return null;
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
  return wsUrl
    .replace(/^ws/, "http")
    .replace(new RegExp(`(?:${HABITAT_RPC_REST_PREFIX}|${HABITAT_RPC_REST_PREFIX_LEGACY})/?$`), "");
}
