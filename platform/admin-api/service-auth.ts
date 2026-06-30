import { verifyServiceApiToken } from "@freeanima/core/db/pg/service-api-token";

import { attachServiceAuthToRequest, type ServiceAuthContext } from "./auth-context.ts";
import {
  isAuthExemptPath,
  isHealthProbePath,
  isHubApiCorsPreflight,
  isSapWebSocketUpgrade,
} from "./remote-auth.ts";

export const SERVICE_AUTH_UNAUTHORIZED = "Unauthorized";

export type ServiceAuthVerifier = {
  verifyRequest(
    req: Request,
    remoteAddress?: string,
  ): Promise<{ blocked: Response | null; auth: ServiceAuthContext | null }>;
};

function normalizeHeader(req: Request, name: string): string | null {
  return req.headers.get(name) ?? req.headers.get(name.toLowerCase()) ?? null;
}

export function parseBearerToken(req: Request): string | null {
  const auth = normalizeHeader(req, "Authorization");
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match?.[1]?.trim() || null;
}

function shouldSkipServiceAuth(req: Request): boolean {
  if (isAuthExemptPath(req)) return true;
  if (isHealthProbePath(req)) return true;
  if (isHubApiCorsPreflight(req)) return true;
  if (isSapWebSocketUpgrade(req)) return true;
  return false;
}

export function createServiceAuthVerifier(): ServiceAuthVerifier {
  return {
    async verifyRequest(req, _remoteAddress) {
      if (shouldSkipServiceAuth(req)) {
        return { blocked: null, auth: null };
      }

      const token = parseBearerToken(req);
      if (!token) {
        return { blocked: new Response(SERVICE_AUTH_UNAUTHORIZED, { status: 401 }), auth: null };
      }

      const auth = await verifyServiceApiToken(token);
      if (!auth) {
        return { blocked: new Response(SERVICE_AUTH_UNAUTHORIZED, { status: 401 }), auth: null };
      }

      return { blocked: null, auth };
    },
  };
}

export function withServiceAuthRequest(req: Request, auth: ServiceAuthContext | null): Request {
  if (!auth) return req;
  return attachServiceAuthToRequest(req, auth);
}

/** health 探活：请求是否带有效 service token（health 路径豁免拦截，但仍应报告 authed） */
export async function evaluateServiceAuthAuthed(req: Request): Promise<boolean> {
  const token = parseBearerToken(req);
  if (!token) return false;
  const auth = await verifyServiceApiToken(token);
  return auth !== null;
}
