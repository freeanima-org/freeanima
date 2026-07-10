import { verifyServiceApiToken } from "@freeanima/core/db/pg/service-api-token";
import type { SapRequestAuthContext } from "@freeanima/shared/sap-contract";
import {
  getHubMethodDef,
  resolveHubAuthPolicy,
  type HubMethod,
} from "@freeanima/shared/hub-contract";

import { handleHttpHubRestRequest } from "./http-rest-router.ts";
import { matchHubHttpRoute } from "./http-rest-auth.ts";
import type { SapServerDeps } from "../sap/types.ts";

function parseBearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match?.[1]?.trim() || null;
}

async function resolveHttpRestAuth(
  req: Request,
  hubMethod: HubMethod,
): Promise<SapRequestAuthContext | null | Response> {
  const optional = resolveHubAuthPolicy(getHubMethodDef(hubMethod).meta) === "optional";
  const token = parseBearerToken(req);
  if (!token) {
    if (optional) return null;
    return new Response("Unauthorized", { status: 401 });
  }
  const auth = await verifyServiceApiToken(token);
  if (!auth) {
    if (optional) return null;
    return new Response("Unauthorized", { status: 401 });
  }
  return auth;
}

/** GET/POST /hub/rpc/v1/{path}：Hub REST（Bearer 鉴权，plain JSON 响应） */
export async function handleHttpHubRestRequestWithAuth(
  req: Request,
  deps: SapServerDeps,
): Promise<Response> {
  const matched = matchHubHttpRoute(req);
  if (!matched) {
    return new Response("Not Found", { status: 404 });
  }

  const authResult = await resolveHttpRestAuth(req, matched.hubMethod);
  if (authResult instanceof Response) return authResult;

  return handleHttpHubRestRequest(req, deps, authResult);
}

export { parseBearerToken };
