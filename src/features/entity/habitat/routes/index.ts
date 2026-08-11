import { omitUndefined } from "@freeanima/host/core/util";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { bindHabitatRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";

import { entityMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type EntityRemoteToolsServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

function depsOf(deps: unknown): EntityRemoteToolsServerDeps {
  return deps as EntityRemoteToolsServerDeps;
}

function ctxAuth(ctx: unknown) {
  return (ctx as RemoteToolsRequestContext).auth;
}

export const entityHabitatRoutes = bindHabitatRouteHandlers(entityMethodDefs, {
  "entity.list": async (deps, input, ctx) =>
    service.serviceEntityList(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "entity.trash.list": async (deps, input, ctx) =>
    service.serviceEntityTrashList(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "entity.get": async (deps, input, ctx) =>
    service.serviceEntityGet(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "entity.delete": async (deps, input, ctx) =>
    service.serviceEntityDelete(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "entity.restore": async (deps, input, ctx) =>
    service.serviceEntityRestore(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "entity.deleteComponent": async (deps, input, ctx) =>
    service.serviceEntityDeleteComponent(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
});
