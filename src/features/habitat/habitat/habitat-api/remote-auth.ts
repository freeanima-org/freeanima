import {
  HABITAT_RPC_REST_PREFIX,
  HABITAT_RPC_REST_PREFIX_LEGACY,
  isHabitatRpcPathname,
} from "@freeanima/shared/habitat-rpc/urls.ts";

export function isLoopbackAddress(addr: string | undefined): boolean {
  if (!addr) return false;
  const normalized = addr.replace(/^::ffff:/, "");
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
}

/** loopback Host：127.0.0.1 / localhost / ::1（与客户端 isLoopbackHabitatUrl 一致） */
export function isInternalHabitatHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^::ffff:/, "");
  return normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1";
}

export function hasCloudflareProxyHeaders(req: Request): boolean {
  return (
    normalizeHeader(req, "cf-access-jwt-assertion") != null ||
    normalizeHeader(req, "cf-connecting-ip") != null ||
    normalizeHeader(req, "cf-ray") != null
  );
}

/** 本机直连：Host 为 loopback 且 TCP 对端为 loopback */
export function isLocalDirectConnection(req: Request, remoteAddress?: string): boolean {
  const host = new URL(req.url).hostname;
  return isInternalHabitatHost(host) && isLoopbackAddress(remoteAddress);
}

/** bundled 客户端跨域 REST 预检：不带 Authorization，须在 service_auth 之前放行 */
export function isHabitatApiCorsPreflight(req: Request): boolean {
  if (req.method !== "OPTIONS") return false;
  const pathname = new URL(req.url).pathname;
  return (
    pathname === "/" ||
    isHabitatRpcPathname(pathname) ||
    pathname === "/mcp" ||
    pathname === "/mcp/"
  );
}

function normalizeHeader(req: Request, name: string): string | null {
  return req.headers.get(name) ?? req.headers.get(name.toLowerCase()) ?? null;
}

export function isSapWebSocketUpgrade(req: Request): boolean {
  const url = new URL(req.url);
  if (url.pathname !== HABITAT_RPC_REST_PREFIX && url.pathname !== HABITAT_RPC_REST_PREFIX_LEGACY) {
    return false;
  }
  const upgrade = normalizeHeader(req, "Upgrade");
  return upgrade?.toLowerCase() === "websocket";
}

export function tokensEqual(expected: string, provided: string): boolean {
  const enc = new TextEncoder();
  const a = enc.encode(expected);
  const b = enc.encode(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
