import { omitUndefined } from "@freeanima/core/util";
import {
  tasklistListInputSchema,
  tasklistCreateInputSchema,
  tasklistPatchInputSchema,
  tasklistDeleteInputSchema,
  smartlistListInputSchema,
  smartlistCreateInputSchema,
  smartlistPatchInputSchema,
  smartlistDeleteInputSchema,
  taskListInputSchema,
  taskCreateInputSchema,
  taskPatchInputSchema,
  taskCompleteInputSchema,
  taskUncompleteInputSchema,
  taskDeleteInputSchema,
  taskSearchInputSchema,
  type SapRequestContext,
} from "../protocol/index.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";
import * as serviceEntityTask from "./service.ts";

/** Minimal SAP server deps for task handlers (structural superset: platform SapServerDeps). */
export type TaskSapServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

export async function handleTasklistList(
  deps: TaskSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = tasklistListInputSchema.parse(payload ?? {});
  return serviceEntityTask.serviceTasklistList(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleTasklistCreate(
  deps: TaskSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = tasklistCreateInputSchema.parse(payload);
  return serviceEntityTask.serviceTasklistCreate(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleTasklistPatch(
  deps: TaskSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = tasklistPatchInputSchema.parse(payload);
  return serviceEntityTask.serviceTasklistPatch(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleTasklistDelete(
  deps: TaskSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = tasklistDeleteInputSchema.parse(payload);
  return serviceEntityTask.serviceTasklistDelete(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleSmartlistList(
  deps: TaskSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = smartlistListInputSchema.parse(payload ?? {});
  return serviceEntityTask.serviceSmartlistList(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleSmartlistCreate(
  deps: TaskSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = smartlistCreateInputSchema.parse(payload);
  return serviceEntityTask.serviceSmartlistCreate(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleSmartlistPatch(
  deps: TaskSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = smartlistPatchInputSchema.parse(payload);
  return serviceEntityTask.serviceSmartlistPatch(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleSmartlistDelete(
  deps: TaskSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = smartlistDeleteInputSchema.parse(payload);
  return serviceEntityTask.serviceSmartlistDelete(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleTaskList(
  deps: TaskSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = taskListInputSchema.parse(payload);
  return serviceEntityTask.serviceTaskList(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleTaskCreate(
  deps: TaskSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = taskCreateInputSchema.parse(payload);
  return serviceEntityTask.serviceTaskCreate(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleTaskPatch(
  deps: TaskSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = taskPatchInputSchema.parse(payload);
  return serviceEntityTask.serviceTaskPatch(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleTaskComplete(
  deps: TaskSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = taskCompleteInputSchema.parse(payload);
  return serviceEntityTask.serviceTaskComplete(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleTaskUncomplete(
  deps: TaskSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = taskUncompleteInputSchema.parse(payload);
  return serviceEntityTask.serviceTaskUncomplete(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleTaskDelete(
  deps: TaskSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = taskDeleteInputSchema.parse(payload);
  return serviceEntityTask.serviceTaskDelete(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleTaskSearch(
  deps: TaskSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = taskSearchInputSchema.parse(payload);
  return serviceEntityTask.serviceTaskSearch(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}
