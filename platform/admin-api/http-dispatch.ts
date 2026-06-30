import { corsPreflightResponse } from "./elysia/cors.ts";
import { isMcpPath } from "@freeanima/capabilities-mcp-server";
import type { ServiceAuthVerifier } from "./service-auth.ts";
import { withServiceAuthRequest } from "./service-auth.ts";

/** Bun requestIP 注入，供 /api/echo 等调试接口展示真实 TCP 来源 */
export const ANIMA_REMOTE_ADDRESS_HEADER = "x-anima-remote-address";

export function attachRemoteAddressToRequest(
  req: Request,
  remoteAddress: string | undefined,
): Request {
  if (!remoteAddress) return req;
  const headers = new Headers(req.headers);
  headers.set(ANIMA_REMOTE_ADDRESS_HEADER, remoteAddress);
  return new Request(req, { headers });
}

/** REST API 或 MCP 路径（须先过 service_auth 中间件） */
export function isHubProtectedHttpPath(pathname: string): boolean {
  return isHubApiPath(pathname) || isMcpPath(pathname);
}

/** REST API 路径（须先过 service_auth 中间件） */
export function isHubApiPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/api" || pathname.startsWith("/api/");
}

/** OPTIONS 预检：在 service_auth 之前返回 CORS 204（Capacitor / Electron 直连 Hub） */
export function handleHubCorsPreflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  if (!isHubProtectedHttpPath(new URL(req.url).pathname)) return null;
  return corsPreflightResponse(req.headers.get("Origin"));
}

export async function applyHttpAuth(
  req: Request,
  remoteAddress: string | undefined,
  serviceAuth: ServiceAuthVerifier | null,
): Promise<{ blocked: Response | null; req: Request }> {
  const withAddress = attachRemoteAddressToRequest(req, remoteAddress);
  if (serviceAuth) {
    const result = await serviceAuth.verifyRequest(withAddress, remoteAddress);
    if (result.blocked) return { blocked: result.blocked, req: withAddress };
    return { blocked: null, req: withServiceAuthRequest(withAddress, result.auth) };
  }
  return { blocked: null, req: withAddress };
}
