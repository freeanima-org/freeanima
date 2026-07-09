import { isHubMethod } from "@freeanima/shared/hub-contract";
import { parseHubRpcEnvelope, serializeHubRpcEnvelope } from "@freeanima/shared/hub-rpc";
import type { SapRequestAuthContext, SapRequestContext } from "@freeanima/shared/sap-contract";
import { verifyServiceApiToken } from "@freeanima/core/db/pg/service-api-token";

import { getFeatureRpcHandler } from "../features/registry.ts";
import { hubDispatch } from "./dispatch.ts";
import type { SapServerDeps } from "../sap/types.ts";

function parseBearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match?.[1]?.trim() || null;
}

function ctxFor(auth: SapRequestAuthContext): SapRequestContext {
  return {
    app_id: "",
    instance_id: "",
    auth,
    sendEvent() {
      /* stateless HTTP RPC — no streaming evt */
    },
  };
}

/** POST /hub/rpc/v1：HubRPC req/res envelope（Bearer 鉴权，无 connect 握手） */
export async function handleHttpHubRpcRequest(
  req: Request,
  deps: SapServerDeps,
): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const token = parseBearerToken(req);
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }
  const auth = await verifyServiceApiToken(token);
  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  let envelope: ReturnType<typeof parseHubRpcEnvelope>;
  try {
    const raw = await req.text();
    envelope = parseHubRpcEnvelope(raw);
  } catch {
    return Response.json({ error: "invalid envelope" }, { status: 400 });
  }

  if (envelope.kind !== "req") {
    return Response.json({ error: "expected req envelope" }, { status: 400 });
  }

  const { id, method, payload } = envelope;
  if (!isHubMethod(method)) {
    return Response.json(
      serializeHubRpcEnvelope({
        kind: "res",
        id,
        ok: false,
        error: { code: "unknown_method", message: `unknown hub method: ${method}` },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!getFeatureRpcHandler(method)) {
    return Response.json(
      serializeHubRpcEnvelope({
        kind: "res",
        id,
        ok: false,
        error: { code: "no_handler", message: `no handler registered for hub method: ${method}` },
      }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const result = await hubDispatch(deps, method, payload, ctxFor(auth));
    return new Response(
      serializeHubRpcEnvelope({
        kind: "res",
        id,
        ok: true,
        payload: result,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[hub-rpc] handler failed:", e);
    return new Response(
      serializeHubRpcEnvelope({
        kind: "res",
        id,
        ok: false,
        error: {
          code: "hub_rpc_error",
          message: "Hub RPC request failed",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
}
