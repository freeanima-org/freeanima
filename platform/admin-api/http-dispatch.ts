import { corsPreflightResponse } from "./elysia/cors.ts";
import { isMcpPath } from "@freeanima/capabilities-mcp-server";
import {
  ANIMA_AUTH_SCOPES_HEADER,
  ANIMA_AUTH_SUBJECT_ID_HEADER,
  ANIMA_AUTH_SUBJECT_TYPE_HEADER,
  ANIMA_AUTH_TOKEN_ID_HEADER,
  type ServiceAuthContext,
} from "./auth-context.ts";
import { isSapWebSocketUpgrade } from "./remote-auth.ts";
import type { ServiceAuthVerifier } from "./service-auth.ts";

/** Bun requestIP 注入，供 /api/echo 等调试接口展示真实 TCP 来源 */
export const ANIMA_REMOTE_ADDRESS_HEADER = "x-anima-remote-address";

/** Bun.serve 下 POST body 流在 await 后不可再 `new Request(req, …)` 二次包装，须一次合并 headers。 */
function decorateRequest(
  req: Request,
  remoteAddress: string | undefined,
  auth: ServiceAuthContext | null,
): Request {
  if (!remoteAddress && !auth) return req;

  const headers = new Headers(req.headers);
  if (remoteAddress) {
    headers.set(ANIMA_REMOTE_ADDRESS_HEADER, remoteAddress);
  }
  if (auth) {
    headers.set(ANIMA_AUTH_SUBJECT_ID_HEADER, String(auth.subject_id));
    headers.set(ANIMA_AUTH_SUBJECT_TYPE_HEADER, auth.subject_type);
    headers.set(ANIMA_AUTH_TOKEN_ID_HEADER, String(auth.token_id));
    headers.set(ANIMA_AUTH_SCOPES_HEADER, auth.scopes.join(","));
  }

  if (req.body != null) {
    return new Request(req.url, {
      method: req.method,
      headers,
      body: req.body,
      duplex: "half",
    } as RequestInit);
  }
  return new Request(req.url, { method: req.method, headers });
}

export function attachRemoteAddressToRequest(
  req: Request,
  remoteAddress: string | undefined,
): Request {
  return decorateRequest(req, remoteAddress, null);
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
  if (serviceAuth) {
    const result = await serviceAuth.verifyRequest(req, remoteAddress);
    if (result.blocked) return { blocked: result.blocked, req };
    return { blocked: null, req: decorateRequest(req, remoteAddress, result.auth) };
  }
  return { blocked: null, req: decorateRequest(req, remoteAddress, null) };
}

type SapBunHandlers = {
  fetch: (req: Request, server: Bun.Server<unknown>) => Response | undefined;
};

/**
 * Bun 要求 WebSocket upgrade 在 fetch 内同步完成（不可先 await）。
 * 成功时返回 undefined，由调用方原样 return 给 Bun.serve。
 */
export function trySapWebSocketUpgrade(
  req: Request,
  bunServer: Bun.Server<unknown>,
  sapHandlers: SapBunHandlers | null,
): Response | undefined | null {
  if (!sapHandlers || !isSapWebSocketUpgrade(req)) return null;
  const sapRes = sapHandlers.fetch(req, bunServer);
  if (sapRes !== undefined) return sapRes;
  return undefined;
}
