export function isLoopbackAddress(addr: string | undefined): boolean {
  if (!addr) return false;
  const normalized = addr.replace(/^::ffff:/, "");
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
}

/** loopback Hub Host：127.0.0.1 / localhost / ::1（与客户端 isLoopbackHubUrl 一致） */
export function isInternalHubHost(hostname: string): boolean {
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
  return isInternalHubHost(host) && isLoopbackAddress(remoteAddress);
}

/** GET /api/health：任意来源均不拦截，认证结果由响应体 authed 报告 */
export function isHealthProbePath(req: Request): boolean {
  return req.method === "GET" && new URL(req.url).pathname === "/api/health";
}

/** GET /api/tls/ca*：局域网 HTTPS 信任引导，须在未信任 CA 时可访问（走 HTTP 端口） */
export function isTlsCaPublicPath(req: Request): boolean {
  if (req.method !== "GET") return false;
  const pathname = new URL(req.url).pathname;
  return (
    pathname === "/api/tls/ca" || pathname === "/api/tls/ca/info" || pathname === "/api/tls/ca/qr"
  );
}

/** bundled 客户端跨域 REST 预检：不带 Authorization，须在 service_auth 之前放行 */
export function isHubApiCorsPreflight(req: Request): boolean {
  if (req.method !== "OPTIONS") return false;
  const pathname = new URL(req.url).pathname;
  return (
    pathname === "/" ||
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname === "/hub/rpc/v1" ||
    pathname === "/mcp" ||
    pathname === "/mcp/"
  );
}

function normalizeHeader(req: Request, name: string): string | null {
  return req.headers.get(name) ?? req.headers.get(name.toLowerCase()) ?? null;
}

export function isSapWebSocketUpgrade(req: Request): boolean {
  const url = new URL(req.url);
  if (url.pathname !== "/hub/rpc/v1") return false;
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
