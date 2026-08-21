import { omitUndefined } from "@freeanima/habitat/core/util";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import {
  bindHabitatRouteHandlers,
  asRouteDeps,
  asRouteCtx,
} from "@freeanima/shared/habitat-contract/route.ts";

import { objectiveMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type ObjectiveRemoteToolsServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

function depsOf(deps: unknown): ObjectiveRemoteToolsServerDeps {
  return asRouteDeps<ObjectiveRemoteToolsServerDeps>(deps);
}

function ctxAuth(ctx: unknown) {
  return asRouteCtx<RemoteToolsRequestContext>(ctx).auth;
}

export const objectiveHabitatRoutes = bindHabitatRouteHandlers(objectiveMethodDefs, {
  "objective.list": async (deps, input, ctx) =>
    service.serviceObjectiveList(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "objective.get": async (deps, input, ctx) =>
    service.serviceObjectiveGet(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
  "objective.create": async (deps, input, ctx) =>
    service.serviceObjectiveCreate(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "objective.patch": async (deps, input, ctx) =>
    service.serviceObjectivePatch(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "objective.delete": async (deps, input, ctx) =>
    service.serviceObjectiveDelete(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "objective.link": async (deps, input, ctx) =>
    service.serviceObjectiveLink(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "objective.unlink": async (deps, input, ctx) =>
    service.serviceObjectiveUnlink(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
});
