import type { HubDispatchContext } from "@freeanima/platform/hub/dispatch.ts";
import type { FeatureRpcHandler } from "@freeanima/platform/features";

import { ApiHandlerError } from "./console-api/handlers/errors.ts";
import { getHealthProbe } from "./console-api/handlers/status.ts";
import {
  getTlsCaInfo,
  getTlsCaPemResponse,
  getTlsCaQrResponse,
} from "./console-api/handlers/tls-ca.ts";

function requireHttpRequest(ctx: HubDispatchContext): Request {
  if (!ctx.httpRequest) {
    throw new Error("public hub method requires HTTP request context");
  }
  return ctx.httpRequest;
}

function qrRequest(ctx: HubDispatchContext, payload: { size?: number }): Request {
  const base = requireHttpRequest(ctx);
  const url = new URL(base.url);
  if (payload.size !== undefined) {
    url.searchParams.set("size", String(payload.size));
  }
  return new Request(url.toString(), base);
}

/** auth: optional 的 Hub RPC handler（health / TLS CA） */
export const consolePublicHubHandlers: Record<string, FeatureRpcHandler> = {
  "health.probe": (_deps, _payload, ctx) => getHealthProbe(requireHttpRequest(ctx)),
  "tls.ca.info": (_deps, _payload, ctx) => getTlsCaInfo(requireHttpRequest(ctx)),
  "tls.ca.qr": async (_deps, payload, ctx) => {
    const res = await getTlsCaQrResponse(qrRequest(ctx, payload as { size?: number }));
    if (!res) {
      throw new ApiHandlerError(404, "TLS CA unavailable", { code: "TLS_CA_UNAVAILABLE" });
    }
    return res;
  },
  "tls.ca": async (_deps, _payload) => {
    const res = getTlsCaPemResponse();
    if (!res) {
      throw new ApiHandlerError(404, "TLS CA unavailable", { code: "TLS_CA_UNAVAILABLE" });
    }
    return res;
  },
};
