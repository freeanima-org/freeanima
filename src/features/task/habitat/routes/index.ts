import { omitUndefined } from "@freeanima/host/core/util";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { bindHabitatRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";

import { taskMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type TaskRemoteToolsServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

function depsOf(deps: unknown): TaskRemoteToolsServerDeps {
  return deps as TaskRemoteToolsServerDeps;
}

function ctxAuth(ctx: unknown) {
  return (ctx as RemoteToolsRequestContext).auth;
}

export const taskHabitatRoutes = bindHabitatRouteHandlers(taskMethodDefs, {
  "tasklist.list": async (deps, input, ctx) =>
    service.serviceTasklistList(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "tasklist.stats": async (deps, input, ctx) =>
    service.serviceTasklistStats(
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
  "tasklist.item.list": async (deps, input, ctx) =>
    service.serviceTasklistItemList(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "tasklist.item.create": async (deps, input, ctx) =>
    service.serviceTasklistItemCreate(
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
  "smartlist.stats": async (deps, input, ctx) =>
    service.serviceSmartlistStats(
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
  "project.item.list": async (deps, input, ctx) =>
    service.serviceProjectItemList(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "project.item.create": async (deps, input, ctx) =>
    service.serviceProjectItemCreate(
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
  "task.moveToProject": async (deps, input, ctx) =>
    service.serviceTaskMoveToProject(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "task.moveToList": async (deps, input, ctx) =>
    service.serviceTaskMoveToList(
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
  "task.skip": async (deps, input, ctx) =>
    service.serviceTaskSkip(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input), ctxAuth(ctx)),
  "task.completeForever": async (deps, input, ctx) =>
    service.serviceTaskCompleteForever(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "task.listOccurrences": async (deps, input, ctx) =>
    service.serviceTaskListOccurrences(
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
