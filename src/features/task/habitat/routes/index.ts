import { omitUndefined } from "@freeanima/host/core/util";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { bindHabitatRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";

import { pumpTaskAdvanceReminders } from "../advance-reminder-stream.ts";
import { taskMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";
import { taskSessionPumps } from "../session-pumps.ts";

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

function ctxOf(ctx: unknown): RemoteToolsRequestContext {
  return ctx as RemoteToolsRequestContext;
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
  "task.get": async (deps, input, ctx) =>
    service.serviceTaskGet(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input), ctxAuth(ctx)),
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
  "task.convertToEvent": async (deps, input, ctx) =>
    service.serviceTaskConvertToEvent(
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
  "task.importDidaCsv": async (deps, input, ctx) =>
    service.serviceTaskImportDidaCsv(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "task.subscribeAdvanceReminders": async (_deps, _input, ctx) => {
    const sapCtx = ctxOf(ctx);
    const sessionPumps = taskSessionPumps();
    const pumpKey = `${sapCtx.app_id}:${sapCtx.instance_id}:task-advance-reminder`;
    if (!sessionPumps.has(pumpKey)) {
      const controller = new AbortController();
      sessionPumps.set(pumpKey, controller);
      void pumpTaskAdvanceReminders(sapCtx, controller.signal).finally(() => {
        sessionPumps.delete(pumpKey);
      });
    }
    return { ok: true as const };
  },
});
