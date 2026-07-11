import { omitUndefined } from "@freeanima/core/util";
import type { SapRequestContext } from "@freeanima/shared/sap-contract";
import { dualTransportMeta } from "@freeanima/shared/hub-contract";
import { defineHubRoute, mergeFeatureRoutes } from "@freeanima/shared/hub-contract/route.ts";
import {
  milestoneCreateInputSchema,
  milestoneCreateOutputSchema,
  milestoneDeleteInputSchema,
  milestoneDeleteOutputSchema,
  milestoneListInputSchema,
  milestoneListOutputSchema,
  milestonePatchInputSchema,
  milestonePatchOutputSchema,
  projectCreateInputSchema,
  projectCreateOutputSchema,
  projectDeleteInputSchema,
  projectDeleteOutputSchema,
  projectGetInputSchema,
  projectGetOutputSchema,
  projectListInputSchema,
  projectListOutputSchema,
  projectPatchInputSchema,
  projectPatchOutputSchema,
  projectfolderCreateInputSchema,
  projectfolderCreateOutputSchema,
  projectfolderDeleteInputSchema,
  projectfolderDeleteOutputSchema,
  projectfolderListInputSchema,
  projectfolderListOutputSchema,
  projectfolderPatchInputSchema,
  projectfolderPatchOutputSchema,
} from "@freeanima/shared/sap-contract/frames/project";

import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type ProjectSapServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

function depsOf(deps: unknown): ProjectSapServerDeps {
  return deps as ProjectSapServerDeps;
}

function ctxAuth(ctx: unknown) {
  return (ctx as SapRequestContext).auth;
}

const routes = [
  defineHubRoute({
    method: "projectfolder.list",
    input: projectfolderListInputSchema,
    output: projectfolderListOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input, ctx) =>
      service.serviceProjectfolderList(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "projectfolder.create",
    input: projectfolderCreateInputSchema,
    output: projectfolderCreateOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceProjectfolderCreate(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "projectfolder.patch",
    input: projectfolderPatchInputSchema,
    output: projectfolderPatchOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceProjectfolderPatch(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "projectfolder.delete",
    input: projectfolderDeleteInputSchema,
    output: projectfolderDeleteOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceProjectfolderDelete(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
  }),
  defineHubRoute({
    method: "project.list",
    input: projectListInputSchema,
    output: projectListOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input, ctx) =>
      service.serviceProjectList(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "project.create",
    input: projectCreateInputSchema,
    output: projectCreateOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceProjectCreate(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "project.get",
    input: projectGetInputSchema,
    output: projectGetOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input, ctx) =>
      service.serviceProjectGet(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
  }),
  defineHubRoute({
    method: "project.patch",
    input: projectPatchInputSchema,
    output: projectPatchOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceProjectPatch(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "project.delete",
    input: projectDeleteInputSchema,
    output: projectDeleteOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceProjectDelete(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
  }),
  defineHubRoute({
    method: "milestone.list",
    input: milestoneListInputSchema,
    output: milestoneListOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input, ctx) =>
      service.serviceMilestoneList(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
  }),
  defineHubRoute({
    method: "milestone.create",
    input: milestoneCreateInputSchema,
    output: milestoneCreateOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceMilestoneCreate(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "milestone.patch",
    input: milestonePatchInputSchema,
    output: milestonePatchOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceMilestonePatch(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "milestone.delete",
    input: milestoneDeleteInputSchema,
    output: milestoneDeleteOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceMilestoneDelete(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
  }),
] as const;

export const projectHubRoutes = mergeFeatureRoutes(routes);
