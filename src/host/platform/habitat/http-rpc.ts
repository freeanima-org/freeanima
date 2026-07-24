import { verifyServiceApiToken } from "@freeanima/host/core/db/pg/service-api-token";
import type { RpcRequestAuthContext } from "@freeanima/shared/rpc-contract";
import {
  getHabitatMethodDef,
  resolveHabitatAuthPolicy,
  type HabitatMethod,
} from "@freeanima/shared/habitat-contract";

import { handleHttpHabitatRestRequest } from "./http-rest-router.ts";
import { matchHabitatHttpRoute } from "./http-rest-auth.ts";
import type { RemoteToolsServerDeps } from "@freeanima/host/capabilities/outpost/transport/types.ts";

function parseBearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match?.[1]?.trim() || null;
}

async function resolveHttpRestAuth(
  req: Request,
  hubMethod: HabitatMethod,
): Promise<RpcRequestAuthContext | null | Response> {
  const optional = resolveHabitatAuthPolicy(getHabitatMethodDef(hubMethod).meta) === "optional";
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

/** GET/POST /rpc/v1/{path}：Habitat RPC REST（Bearer 鉴权，plain JSON 响应） */
export async function handleHttpHabitatRestRequestWithAuth(
  req: Request,
  deps: RemoteToolsServerDeps,
): Promise<Response> {
  const matched = matchHabitatHttpRoute(req);
  if (!matched) {
    return new Response("Not Found", { status: 404 });
  }

  const authResult = await resolveHttpRestAuth(req, matched.hubMethod);
  if (authResult instanceof Response) return authResult;

  return handleHttpHabitatRestRequest(req, deps, authResult);
}

export { parseBearerToken };
