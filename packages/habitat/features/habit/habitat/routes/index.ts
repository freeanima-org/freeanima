import { omitUndefined } from "@freeanima/habitat/core/util";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import {
  bindHabitatRouteHandlers,
  asRouteDeps,
  asRouteCtx,
} from "@freeanima/shared/habitat-contract/route.ts";

import { habitMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type HabitRemoteToolsServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

function depsOf(deps: unknown): HabitRemoteToolsServerDeps {
  return asRouteDeps<HabitRemoteToolsServerDeps>(deps);
}

function ctxAuth(ctx: unknown) {
  return asRouteCtx<RemoteToolsRequestContext>(ctx).auth;
}

export const habitHabitatRoutes = bindHabitatRouteHandlers(habitMethodDefs, {
  "habit.list": async (deps, input, ctx) =>
    service.serviceHabitList(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "habit.get": async (deps, input, ctx) =>
    service.serviceHabitGet(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input), ctxAuth(ctx)),
  "habit.create": async (deps, input, ctx) =>
    service.serviceHabitCreate(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "habit.patch": async (deps, input, ctx) =>
    service.serviceHabitPatch(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "habit.delete": async (deps, input, ctx) =>
    service.serviceHabitDelete(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "habit.reorder": async (deps, input, ctx) =>
    service.serviceHabitReorder(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "habit.archive": async (deps, input, ctx) =>
    service.serviceHabitArchive(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "habit.unarchive": async (deps, input, ctx) =>
    service.serviceHabitUnarchive(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "habit.checkIn": async (deps, input, ctx) =>
    service.serviceHabitCheckIn(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "habit.undoCheckIn": async (deps, input, ctx) =>
    service.serviceHabitUndoCheckIn(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "habit.listCheckIns": async (deps, input, ctx) =>
    service.serviceHabitListCheckIns(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "habit.stats": async (deps, input, ctx) =>
    service.serviceHabitStats(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "habit.presets": async (deps, input, ctx) =>
    service.serviceHabitPresets(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
});
