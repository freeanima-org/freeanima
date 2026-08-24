import { omitUndefined } from "@freeanima/habitat/core/util";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import {
  bindHabitatRouteHandlers,
  asRouteDeps,
  asRouteCtx,
} from "@freeanima/shared/habitat-contract/route.ts";

import { handleHealthAttachFiles, handleHealthFileUpload } from "../binary.ts";
import { healthMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type HealthRemoteToolsServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

function depsOf(deps: unknown): HealthRemoteToolsServerDeps {
  return asRouteDeps<HealthRemoteToolsServerDeps>(deps);
}

function ctxAuth(ctx: unknown) {
  return asRouteCtx<RemoteToolsRequestContext>(ctx).auth;
}

export const healthHabitatRoutes = bindHabitatRouteHandlers(healthMethodDefs, {
  "health.list": async (deps, input, ctx) =>
    service.serviceHealthList(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "health.get": async (deps, input, ctx) =>
    service.serviceHealthGet(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
  "health.search": async (deps, input, ctx) =>
    service.serviceHealthSearch(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "health.create": async (deps, input, ctx) =>
    service.serviceHealthCreate(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "health.patch": async (deps, input, ctx) =>
    service.serviceHealthPatch(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "health.delete": async (deps, input, ctx) =>
    service.serviceHealthDelete(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
  "health.metrics.series": async (deps, input, ctx) =>
    service.serviceHealthMetricsSeries(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "health.attachFiles": async (deps, input, ctx) =>
    handleHealthAttachFiles(deps, input, asRouteCtx<RemoteToolsRequestContext>(ctx)),
  "health.file.upload": async (deps, input, ctx) =>
    handleHealthFileUpload(deps, input, asRouteCtx<RemoteToolsRequestContext>(ctx)),
});
