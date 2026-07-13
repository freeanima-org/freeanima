import { omitUndefined } from "@freeanima/core/util";
import type { SapRequestContext } from "@freeanima/shared/sap-contract";
import { bindHubRouteHandlers } from "@freeanima/shared/hub-contract/route.ts";

import { taskMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type TaskSapServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

function depsOf(deps: unknown): TaskSapServerDeps {
  return deps as TaskSapServerDeps;
}

function ctxAuth(ctx: unknown) {
  return (ctx as SapRequestContext).auth;
}

export const taskHubRoutes = bindHubRouteHandlers(taskMethodDefs, {
  "tasklist.list": async (deps, input, ctx) =>
    service.serviceTasklistList(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "tasklist.create": async (deps, input, ctx) =>
    service.serviceTasklistCreate(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "tasklist.patch": async (deps, input, ctx) =>
    service.serviceTasklistPatch(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "tasklist.delete": async (deps, input, ctx) =>
    service.serviceTasklistDelete(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "smartlist.list": async (deps, input, ctx) =>
    service.serviceSmartlistList(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "smartlist.create": async (deps, input, ctx) =>
    service.serviceSmartlistCreate(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "smartlist.patch": async (deps, input, ctx) =>
    service.serviceSmartlistPatch(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "smartlist.delete": async (deps, input, ctx) =>
    service.serviceSmartlistDelete(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "task.list": async (deps, input, ctx) =>
    service.serviceTaskList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input), ctxAuth(ctx)),
  "task.create": async (deps, input, ctx) =>
    service.serviceTaskCreate(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "task.patch": async (deps, input, ctx) =>
    service.serviceTaskPatch(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "task.complete": async (deps, input, ctx) =>
    service.serviceTaskComplete(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "task.uncomplete": async (deps, input, ctx) =>
    service.serviceTaskUncomplete(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "task.delete": async (deps, input, ctx) =>
    service.serviceTaskDelete(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "task.search": async (deps, input, ctx) =>
    service.serviceTaskSearch(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
});
