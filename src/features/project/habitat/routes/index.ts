import { omitUndefined } from "@freeanima/core/util";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { bindHabitatRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";

import { projectMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type ProjectRemoteToolsServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

function depsOf(deps: unknown): ProjectRemoteToolsServerDeps {
  return deps as ProjectRemoteToolsServerDeps;
}

function ctxAuth(ctx: unknown) {
  return (ctx as RemoteToolsRequestContext).auth;
}

export const projectHabitatRoutes = bindHabitatRouteHandlers(projectMethodDefs, {
  "projectfolder.list": async (deps, input, ctx) =>
    service.serviceProjectfolderList(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "projectfolder.create": async (deps, input, ctx) =>
    service.serviceProjectfolderCreate(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "projectfolder.patch": async (deps, input, ctx) =>
    service.serviceProjectfolderPatch(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "projectfolder.delete": async (deps, input, ctx) =>
    service.serviceProjectfolderDelete(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
  "project.list": async (deps, input, ctx) =>
    service.serviceProjectList(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "project.stats": async (deps, input, ctx) =>
    service.serviceProjectStats(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "project.create": async (deps, input, ctx) =>
    service.serviceProjectCreate(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "project.get": async (deps, input, ctx) =>
    service.serviceProjectGet(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
  "project.patch": async (deps, input, ctx) =>
    service.serviceProjectPatch(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "project.delete": async (deps, input, ctx) =>
    service.serviceProjectDelete(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
});
