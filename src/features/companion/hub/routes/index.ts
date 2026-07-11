import { z } from "zod";

import type { SapServerDeps } from "@freeanima/platform/sap/types";
import type { SapRequestContext } from "@freeanima/shared/sap-contract";
import { binaryHttpMeta, dualTransportMeta } from "@freeanima/shared/hub-contract";
import { defineHubRoute, mergeFeatureRoutes } from "@freeanima/shared/hub-contract/route.ts";
import {
  companionConfigGetInputSchema,
  companionConfigGetOutputSchema,
  companionConfigUpdateInputSchema,
  companionConfigUpdateOutputSchema,
  companionMigrateFromLocalInputSchema,
  companionMigrateFromLocalOutputSchema,
  companionModelDeleteInputSchema,
  companionModelDeleteOutputSchema,
  companionModelRenameInputSchema,
  companionModelRenameOutputSchema,
  companionModelSetActiveInputSchema,
  companionModelSetActiveOutputSchema,
  companionMotionDeleteInputSchema,
  companionMotionDeleteOutputSchema,
  companionMotionRenameInputSchema,
  companionMotionRenameOutputSchema,
  companionMotionSetSlotInputSchema,
  companionMotionSetSlotOutputSchema,
  companionSyncPullInputSchema,
  companionSyncPullOutputSchema,
} from "@freeanima/shared/sap-contract/frames/companion";

import {
  handleCompanionAssetGet,
  handleCompanionModelUpload,
  handleCompanionMotionImport,
} from "../binary.ts";
import * as service from "../service.ts";

function depsOf(deps: unknown): SapServerDeps {
  return deps as SapServerDeps;
}

function ctxOf(ctx: unknown): SapRequestContext {
  return ctx as SapRequestContext;
}

const emptyInputSchema = z.object({}).passthrough();
const companionAssetGetInputSchema = z.object({
  kind: z.enum(["models", "motions"]),
  fileName: z.string().min(1),
});
const companionUploadOkOutputSchema = z.object({ ok: z.literal(true) });

const routes = [
  defineHubRoute({
    method: "companion.config.get",
    input: companionConfigGetInputSchema,
    output: companionConfigGetOutputSchema,
    meta: dualTransportMeta(true),
    handler: async () => service.serviceCompanionConfigGet(),
  }),
  defineHubRoute({
    method: "companion.config.update",
    input: companionConfigUpdateInputSchema,
    output: companionConfigUpdateOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (_deps, input) =>
      service.serviceCompanionConfigUpdate(service.serviceCompanionConfigUpdateOmit(input)),
  }),
  defineHubRoute({
    method: "companion.model.setActive",
    input: companionModelSetActiveInputSchema,
    output: companionModelSetActiveOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (_deps, input) => service.serviceCompanionModelSetActive(input),
  }),
  defineHubRoute({
    method: "companion.model.rename",
    input: companionModelRenameInputSchema,
    output: companionModelRenameOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (_deps, input) => service.serviceCompanionModelRename(input),
  }),
  defineHubRoute({
    method: "companion.model.delete",
    input: companionModelDeleteInputSchema,
    output: companionModelDeleteOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (_deps, input) => service.serviceCompanionModelDelete(input),
  }),
  defineHubRoute({
    method: "companion.motion.setSlot",
    input: companionMotionSetSlotInputSchema,
    output: companionMotionSetSlotOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (_deps, input) => service.serviceCompanionMotionSetSlot(input),
  }),
  defineHubRoute({
    method: "companion.motion.rename",
    input: companionMotionRenameInputSchema,
    output: companionMotionRenameOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (_deps, input) => service.serviceCompanionMotionRename(input),
  }),
  defineHubRoute({
    method: "companion.motion.delete",
    input: companionMotionDeleteInputSchema,
    output: companionMotionDeleteOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (_deps, input) => service.serviceCompanionMotionDelete(input),
  }),
  defineHubRoute({
    method: "companion.migrate.fromLocal",
    input: companionMigrateFromLocalInputSchema,
    output: companionMigrateFromLocalOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (_deps, input) => service.serviceCompanionMigrateFromLocal(input),
  }),
  defineHubRoute({
    method: "companion.sync.pull",
    input: companionSyncPullInputSchema,
    output: companionSyncPullOutputSchema,
    meta: dualTransportMeta(true),
    handler: async () => service.serviceCompanionSyncPull(),
  }),
  defineHubRoute({
    method: "companion.asset.get",
    input: companionAssetGetInputSchema,
    output: z.record(z.string(), z.unknown()),
    meta: binaryHttpMeta({
      verb: "GET",
      path: "companion/assets/:kind/:fileName",
      pathParams: ["kind", "fileName"],
      response: "raw",
    }),
    handler: async (deps, input, ctx) =>
      handleCompanionAssetGet(depsOf(deps), input, ctxOf(ctx)) as unknown as Promise<
        Record<string, unknown>
      >,
  }),
  defineHubRoute({
    method: "companion.model.upload",
    input: emptyInputSchema,
    output: companionUploadOkOutputSchema,
    meta: binaryHttpMeta({
      verb: "POST",
      path: "companion/model/upload",
      request: "multipart",
    }),
    handler: async (deps, input, ctx) =>
      handleCompanionModelUpload(depsOf(deps), input, ctxOf(ctx)),
  }),
  defineHubRoute({
    method: "companion.motion.import",
    input: emptyInputSchema,
    output: z.record(z.string(), z.unknown()),
    meta: binaryHttpMeta({
      verb: "POST",
      path: "companion/motion/import",
      request: "multipart",
    }),
    handler: async (deps, input, ctx) =>
      handleCompanionMotionImport(depsOf(deps), input, ctxOf(ctx)),
  }),
] as const;

export const companionHubRoutes = mergeFeatureRoutes(routes);
