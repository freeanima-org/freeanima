import { omitUndefined } from "@freeanima/core/util";
import type { SapRequestContext } from "@freeanima/shared/sap-contract";
import { dualTransportMeta } from "@freeanima/shared/hub-contract";
import { defineHubRoute, mergeFeatureRoutes } from "@freeanima/shared/hub-contract/route.ts";
import {
  smartlistCreateInputSchema,
  smartlistCreateOutputSchema,
  smartlistDeleteInputSchema,
  smartlistDeleteOutputSchema,
  smartlistListInputSchema,
  smartlistListOutputSchema,
  smartlistPatchInputSchema,
  smartlistPatchOutputSchema,
  taskCompleteInputSchema,
  taskCompleteOutputSchema,
  taskCreateInputSchema,
  taskCreateOutputSchema,
  taskDeleteInputSchema,
  taskDeleteOutputSchema,
  taskListInputSchema,
  taskListOutputSchema,
  taskPatchInputSchema,
  taskPatchOutputSchema,
  taskSearchInputSchema,
  taskSearchOutputSchema,
  taskUncompleteInputSchema,
  taskUncompleteOutputSchema,
  tasklistCreateInputSchema,
  tasklistCreateOutputSchema,
  tasklistDeleteInputSchema,
  tasklistDeleteOutputSchema,
  tasklistListInputSchema,
  tasklistListOutputSchema,
  tasklistPatchInputSchema,
  tasklistPatchOutputSchema,
} from "@freeanima/shared/sap-contract/frames/task";

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

const routes = [
  defineHubRoute({
    method: "tasklist.list",
    input: tasklistListInputSchema,
    output: tasklistListOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input, ctx) =>
      service.serviceTasklistList(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "tasklist.create",
    input: tasklistCreateInputSchema,
    output: tasklistCreateOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceTasklistCreate(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "tasklist.patch",
    input: tasklistPatchInputSchema,
    output: tasklistPatchOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceTasklistPatch(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "tasklist.delete",
    input: tasklistDeleteInputSchema,
    output: tasklistDeleteOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceTasklistDelete(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "smartlist.list",
    input: smartlistListInputSchema,
    output: smartlistListOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input, ctx) =>
      service.serviceSmartlistList(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "smartlist.create",
    input: smartlistCreateInputSchema,
    output: smartlistCreateOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceSmartlistCreate(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "smartlist.patch",
    input: smartlistPatchInputSchema,
    output: smartlistPatchOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceSmartlistPatch(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "smartlist.delete",
    input: smartlistDeleteInputSchema,
    output: smartlistDeleteOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceSmartlistDelete(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "task.list",
    input: taskListInputSchema,
    output: taskListOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input, ctx) =>
      service.serviceTaskList(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "task.create",
    input: taskCreateInputSchema,
    output: taskCreateOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceTaskCreate(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "task.patch",
    input: taskPatchInputSchema,
    output: taskPatchOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceTaskPatch(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "task.complete",
    input: taskCompleteInputSchema,
    output: taskCompleteOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceTaskComplete(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "task.uncomplete",
    input: taskUncompleteInputSchema,
    output: taskUncompleteOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceTaskUncomplete(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "task.delete",
    input: taskDeleteInputSchema,
    output: taskDeleteOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceTaskDelete(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "task.search",
    input: taskSearchInputSchema,
    output: taskSearchOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input, ctx) =>
      service.serviceTaskSearch(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
] as const;

export const taskHubRoutes = mergeFeatureRoutes(routes);
