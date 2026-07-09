import { omitUndefined } from "@freeanima/core/util";
import {
  milestoneCreateInputSchema,
  milestoneDeleteInputSchema,
  milestoneListInputSchema,
  milestonePatchInputSchema,
  projectCreateInputSchema,
  projectDeleteInputSchema,
  projectGetInputSchema,
  projectListInputSchema,
  projectPatchInputSchema,
  projectfolderCreateInputSchema,
  projectfolderDeleteInputSchema,
  projectfolderListInputSchema,
  projectfolderPatchInputSchema,
  type SapRequestContext,
} from "../protocol/index.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";
import * as serviceProject from "./service.ts";

export type ProjectSapServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

export async function handleProjectfolderList(
  deps: ProjectSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = projectfolderListInputSchema.parse(payload ?? {});
  return serviceProject.serviceProjectfolderList(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleProjectfolderCreate(
  deps: ProjectSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = projectfolderCreateInputSchema.parse(payload);
  return serviceProject.serviceProjectfolderCreate(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleProjectfolderPatch(
  deps: ProjectSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = projectfolderPatchInputSchema.parse(payload);
  return serviceProject.serviceProjectfolderPatch(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleProjectfolderDelete(
  deps: ProjectSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = projectfolderDeleteInputSchema.parse(payload);
  return serviceProject.serviceProjectfolderDelete(deps.runtime.runtimeDeps(), input, ctx.auth);
}

export async function handleProjectList(
  deps: ProjectSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = projectListInputSchema.parse(payload ?? {});
  return serviceProject.serviceProjectList(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleProjectCreate(
  deps: ProjectSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = projectCreateInputSchema.parse(payload);
  return serviceProject.serviceProjectCreate(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleProjectGet(
  deps: ProjectSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = projectGetInputSchema.parse(payload);
  return serviceProject.serviceProjectGet(deps.runtime.runtimeDeps(), input, ctx.auth);
}

export async function handleProjectPatch(
  deps: ProjectSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = projectPatchInputSchema.parse(payload);
  return serviceProject.serviceProjectPatch(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleProjectDelete(
  deps: ProjectSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = projectDeleteInputSchema.parse(payload);
  return serviceProject.serviceProjectDelete(deps.runtime.runtimeDeps(), input, ctx.auth);
}

export async function handleMilestoneList(
  deps: ProjectSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = milestoneListInputSchema.parse(payload);
  return serviceProject.serviceMilestoneList(deps.runtime.runtimeDeps(), input, ctx.auth);
}

export async function handleMilestoneCreate(
  deps: ProjectSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = milestoneCreateInputSchema.parse(payload);
  return serviceProject.serviceMilestoneCreate(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleMilestonePatch(
  deps: ProjectSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = milestonePatchInputSchema.parse(payload);
  return serviceProject.serviceMilestonePatch(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleMilestoneDelete(
  deps: ProjectSapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = milestoneDeleteInputSchema.parse(payload);
  return serviceProject.serviceMilestoneDelete(deps.runtime.runtimeDeps(), input, ctx.auth);
}
