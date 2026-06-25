export const REMOTE_AUTH_UNAUTHORIZED = "Unauthorized";

export type RemoteAuthVerifier = {
  verifyRequest(req: Request, remoteAddress?: string): Promise<Response | null>;
};

export type RemoteAuthConfig = {
  token?: string;
};

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

/** cloudflared 连本机时 requestIP 为 loopback，但会带上 CF 代理头（仅供 /api/echo 诊断） */
export function hasCloudflareProxyHeaders(req: Request): boolean {
  return (
    normalizeHeader(req, "cf-access-jwt-assertion") !== null ||
    normalizeHeader(req, "cf-connecting-ip") !== null ||
    normalizeHeader(req, "cf-ray") !== null
  );
}

/** 本机直连：Host 为 loopback 且 TCP 对端为 loopback */
export function isLocalDirectConnection(req: Request, remoteAddress?: string): boolean {
  const host = new URL(req.url).hostname;
  return isInternalHubHost(host) && isLoopbackAddress(remoteAddress);
}

/** 调试回显：任意来源均不验 remote_auth */
export function isAuthExemptPath(req: Request): boolean {
  return new URL(req.url).pathname === "/api/echo";
}

/** loopback 探活：CLI / systemd 无 token 轮询（保留供测试与语义说明） */
export function isLoopbackHealthProbe(req: Request, remoteAddress?: string): boolean {
  if (req.method !== "GET") return false;
  if (!isLocalDirectConnection(req, remoteAddress)) return false;
  return new URL(req.url).pathname === "/api/health";
}

/** GET /api/health：任意来源均不拦截，认证结果由响应体 authed 报告 */
export function isHealthProbePath(req: Request): boolean {
  return req.method === "GET" && new URL(req.url).pathname === "/api/health";
}

/** bundled 客户端跨域 REST 预检：不带 Authorization，须在 remote_auth 之前放行 */
export function isHubApiCorsPreflight(req: Request): boolean {
  if (req.method !== "OPTIONS") return false;
  const pathname = new URL(req.url).pathname;
  return (
    pathname === "/" ||
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname === "/mcp" ||
    pathname === "/mcp/"
  );
}

/** 跳过 remote_auth：豁免路径、health 探活、CORS 预检、或 Host+peer 均为 loopback 的本机直连 */
export function shouldBypassRemoteAuth(req: Request, remoteAddress?: string): boolean {
  if (isAuthExemptPath(req)) return true;
  if (isHealthProbePath(req)) return true;
  if (isHubApiCorsPreflight(req)) return true;
  return isLocalDirectConnection(req, remoteAddress);
}

/** health 探活：模拟正常 REST 路径的 remote_auth 是否通过（不含 health 中间件豁免） */
export function evaluateRemoteAuthAuthed(
  req: Request,
  remoteAddress: string | undefined,
  expectedToken: string | null | undefined,
): boolean {
  if (isLocalDirectConnection(req, remoteAddress)) return true;
  const expected = expectedToken?.trim() || null;
  if (!expected) return false;
  return verifyRemoteAuthToken(expected, parseBearerToken(req));
}

function normalizeHeader(req: Request, name: string): string | null {
  return req.headers.get(name) ?? req.headers.get(name.toLowerCase()) ?? null;
}

function parseBearerToken(req: Request): string | null {
  const auth = normalizeHeader(req, "Authorization");
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match?.[1]?.trim() || null;
}

function isSapWebSocketUpgrade(req: Request): boolean {
  const url = new URL(req.url);
  if (url.pathname !== "/sap/v1") return false;
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

export function verifyRemoteAuthToken(
  expected: string | null | undefined,
  provided: string | null | undefined,
): boolean {
  const exp = expected?.trim();
  if (!exp) return false;
  if (!provided?.trim()) return false;
  return tokensEqual(exp, provided.trim());
}

export function createRemoteAuthVerifier(config: RemoteAuthConfig = {}): RemoteAuthVerifier {
  const expected = config.token?.trim() || null;
  return {
    async verifyRequest(req, remoteAddress) {
      if (shouldBypassRemoteAuth(req, remoteAddress)) return null;
      if (isSapWebSocketUpgrade(req)) return null;

      const token = parseBearerToken(req);
      if (!verifyRemoteAuthToken(expected, token)) {
        return new Response(REMOTE_AUTH_UNAUTHORIZED, { status: 401 });
      }
      return null;
    },
  };
}
