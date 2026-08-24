import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { bindHabitatRouteHandlers, asRouteCtx } from "@freeanima/shared/habitat-contract/route.ts";
import { omitUndefined } from "@freeanima/habitat/core/util";

import { federationMethodDefs } from "../method-defs.ts";
import * as service from "../service.ts";

function ctxAuth(ctx: unknown) {
  return asRouteCtx<RemoteToolsRequestContext>(ctx).auth;
}

export const federationHabitatRoutes = bindHabitatRouteHandlers(federationMethodDefs, {
  "federation.status": async () => service.serviceFederationStatus(),
  "federation.satellite.list": async (_deps, _input, ctx) =>
    service.serviceFederationSatelliteList(ctxAuth(ctx)),
  "federation.satellite.create": async (_deps, input, ctx) =>
    service.serviceFederationSatelliteCreate(omitUndefined(input), ctxAuth(ctx)),
  "federation.satellite.revoke": async (_deps, input, ctx) =>
    service.serviceFederationSatelliteRevoke(input, ctxAuth(ctx)),
  "federation.satellite.approve": async (_deps, input, ctx) =>
    service.serviceFederationSatelliteApprove(omitUndefined(input), ctxAuth(ctx)),
  "federation.satellite.reject": async (_deps, input, ctx) =>
    service.serviceFederationSatelliteReject(input, ctxAuth(ctx)),
  "federation.ping": async (_deps, input) => service.serviceFederationPing(omitUndefined(input)),
});
