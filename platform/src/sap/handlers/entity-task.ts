import {
  tasklistListInputSchema,
  tasklistCreateInputSchema,
  tasklistPatchInputSchema,
  tasklistDeleteInputSchema,
  taskListInputSchema,
  taskCreateInputSchema,
  taskPatchInputSchema,
  taskCompleteInputSchema,
  taskUncompleteInputSchema,
  taskDeleteInputSchema,
} from "@freeanima/sap-contract";
import type { SapServerDeps } from "./types.ts";
import * as serviceEntityTask from "../runtime/service-entity-task.ts";

export async function handleTasklistList(deps: SapServerDeps, payload: unknown) {
  const input = tasklistListInputSchema.parse(payload);
  return serviceEntityTask.serviceTasklistList(deps.runtime.runtimeDeps(), input);
}

export async function handleTasklistCreate(deps: SapServerDeps, payload: unknown) {
  const input = tasklistCreateInputSchema.parse(payload);
  return serviceEntityTask.serviceTasklistCreate(deps.runtime.runtimeDeps(), input);
}

export async function handleTasklistPatch(deps: SapServerDeps, payload: unknown) {
  const input = tasklistPatchInputSchema.parse(payload);
  return serviceEntityTask.serviceTasklistPatch(deps.runtime.runtimeDeps(), input);
}

export async function handleTasklistDelete(deps: SapServerDeps, payload: unknown) {
  const input = tasklistDeleteInputSchema.parse(payload);
  return serviceEntityTask.serviceTasklistDelete(deps.runtime.runtimeDeps(), input);
}

export async function handleTaskList(deps: SapServerDeps, payload: unknown) {
  const input = taskListInputSchema.parse(payload);
  return serviceEntityTask.serviceTaskList(deps.runtime.runtimeDeps(), input);
}

export async function handleTaskCreate(deps: SapServerDeps, payload: unknown) {
  const input = taskCreateInputSchema.parse(payload);
  return serviceEntityTask.serviceTaskCreate(deps.runtime.runtimeDeps(), input);
}

export async function handleTaskPatch(deps: SapServerDeps, payload: unknown) {
  const input = taskPatchInputSchema.parse(payload);
  return serviceEntityTask.serviceTaskPatch(deps.runtime.runtimeDeps(), input);
}

export async function handleTaskComplete(deps: SapServerDeps, payload: unknown) {
  const input = taskCompleteInputSchema.parse(payload);
  return serviceEntityTask.serviceTaskComplete(deps.runtime.runtimeDeps(), input.id);
}

export async function handleTaskUncomplete(deps: SapServerDeps, payload: unknown) {
  const input = taskUncompleteInputSchema.parse(payload);
  return serviceEntityTask.serviceTaskUncomplete(deps.runtime.runtimeDeps(), input.id);
}

export async function handleTaskDelete(deps: SapServerDeps, payload: unknown) {
  const input = taskDeleteInputSchema.parse(payload);
  return serviceEntityTask.serviceTaskDelete(deps.runtime.runtimeDeps(), input.id);
}
