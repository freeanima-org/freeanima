import { verifyServiceApiToken } from "@freeanima/core/db/pg/service-api-token";

import type { ServiceAuthContext } from "./auth-context.ts";
import { isHubApiCorsPreflight, isSapWebSocketUpgrade } from "./remote-auth.ts";
import { isOptionalAuthHubHttpRequest } from "@freeanima/platform/hub/http-rest-auth.ts";

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
  if (isHubApiCorsPreflight(req)) return true;
  if (isSapWebSocketUpgrade(req)) return true;
  return false;
}

async function verifyBearerToken(
  req: Request,
): Promise<{ blocked: Response | null; auth: ServiceAuthContext | null }> {
  const optional = isOptionalAuthHubHttpRequest(req);
  const token = parseBearerToken(req);
  if (!token) {
    if (optional) return { blocked: null, auth: null };
    return { blocked: new Response(SERVICE_AUTH_UNAUTHORIZED, { status: 401 }), auth: null };
  }

  const auth = await verifyServiceApiToken(token);
  if (!auth) {
    if (optional) return { blocked: null, auth: null };
    return { blocked: new Response(SERVICE_AUTH_UNAUTHORIZED, { status: 401 }), auth: null };
  }

  return { blocked: null, auth };
}

export function createServiceAuthVerifier(): ServiceAuthVerifier {
  return {
    async verifyRequest(req, _remoteAddress) {
      if (shouldSkipServiceAuth(req)) {
        return { blocked: null, auth: null };
      }
      return verifyBearerToken(req);
    },
  };
}

/** health 探活：请求是否带有效 service token（health 路径豁免拦截，但仍应报告 authed） */
export async function evaluateServiceAuthAuthed(req: Request): Promise<boolean> {
  const token = parseBearerToken(req);
  if (!token) return false;
  const auth = await verifyServiceApiToken(token);
  return auth != null;
}
