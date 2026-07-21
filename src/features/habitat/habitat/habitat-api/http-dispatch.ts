import {
  HABITAT_RPC_REST_PREFIX,
  HABITAT_RPC_REST_PREFIX_LEGACY,
  isHabitatRpcPathname,
  legacyRpcRedirectLocation,
} from "@freeanima/shared/habitat-rpc/urls.ts";
import { corsPreflightResponse } from "./cors.ts";
import { isMcpPath } from "@freeanima/capabilities/mcp-server";
import type { ServiceAuthContext } from "./auth-context.ts";
import { isSapWebSocketUpgrade } from "./remote-auth.ts";
import type { ServiceAuthVerifier } from "./service-auth.ts";

/** Bun requestIP 注入，供 health 等接口展示真实 TCP 来源 */
export const ANIMA_REMOTE_ADDRESS_HEADER = "x-anima-remote-address";

function attachRemoteAddress(req: Request, remoteAddress: string | undefined): Request {
  if (!remoteAddress) return req;
  const headers = new Headers(req.headers);
  headers.set(ANIMA_REMOTE_ADDRESS_HEADER, remoteAddress);
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
  return attachRemoteAddress(req, remoteAddress);
}

/** Habitat RPC / MCP 路径（须先过 service_auth） */
export function isHabitatProtectedHttpPath(pathname: string): boolean {
  return isHabitatRpcPath(pathname) || isMcpPath(pathname);
}

export function isHabitatRpcPath(pathname: string): boolean {
  return isHabitatRpcPathname(pathname);
}

/**
 * 旧 `/hub/rpc/v1` HTTP → `/rpc/v1` 302（WS 不重定向，由双挂兼容）。
 * @deprecated 0.9.3 删除
 */
export function legacyRpcHttpRedirect(req: Request): Response | null {
  if (isSapWebSocketUpgrade(req)) return null;
  const url = new URL(req.url);
  const location = legacyRpcRedirectLocation(url);
  if (!location) return null;
  return Response.redirect(new URL(location, url.origin).toString(), 302);
}

/** OPTIONS 预检：在 service_auth 之前返回 CORS 204（Capacitor / Electron 直连） */
export function handleHabitatCorsPreflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  if (!isHabitatProtectedHttpPath(new URL(req.url).pathname)) return null;
  return corsPreflightResponse(req.headers.get("Origin"));
}

export async function applyHttpAuth(
  req: Request,
  remoteAddress: string | undefined,
  serviceAuth: ServiceAuthVerifier | null,
): Promise<{ blocked: Response | null; req: Request; auth: ServiceAuthContext | null }> {
  if (serviceAuth) {
    const result = await serviceAuth.verifyRequest(req, remoteAddress);
    if (result.blocked) return { blocked: result.blocked, req, auth: null };
    return {
      blocked: null,
      req: attachRemoteAddress(req, remoteAddress),
      auth: result.auth,
    };
  }
  return { blocked: null, req: attachRemoteAddress(req, remoteAddress), auth: null };
}

type SapBunHandlers = {
  fetch: (req: Request, server: Bun.Server<unknown>) => Response | Promise<Response> | undefined;
};

/**
 * Bun 要求 WebSocket upgrade 在 fetch 内同步完成（不可先 await）。
 * 成功时返回 undefined，由调用方原样 return 给 Bun.serve。
 */
export function trySapWebSocketUpgrade(
  req: Request,
  bunServer: Bun.Server<unknown>,
  sapHandlers: SapBunHandlers | null,
): Response | Promise<Response> | undefined | null {
  if (!sapHandlers || !isSapWebSocketUpgrade(req)) return null;
  const sapRes = sapHandlers.fetch(req, bunServer);
  if (sapRes !== undefined) return sapRes;
  return undefined;
}

export { HABITAT_RPC_REST_PREFIX, HABITAT_RPC_REST_PREFIX_LEGACY };
