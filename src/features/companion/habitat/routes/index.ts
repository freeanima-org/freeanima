import type { RemoteToolsServerDeps } from "@freeanima/platform/remote-tools/types";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { bindHabitatRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";

import {
  handleCompanionAssetGet,
  handleCompanionModelUpload,
  handleCompanionMotionImport,
} from "../binary.ts";
import { companionMethodDefs } from "../method-defs.ts";
import * as service from "../service.ts";

function depsOf(deps: unknown): RemoteToolsServerDeps {
  return deps as RemoteToolsServerDeps;
}

function ctxOf(ctx: unknown): RemoteToolsRequestContext {
  return ctx as RemoteToolsRequestContext;
}

export const companionHabitatRoutes = bindHabitatRouteHandlers(companionMethodDefs, {
  "companion.config.get": async () => service.serviceCompanionConfigGet(),
  "companion.config.update": async (_deps, input) =>
    service.serviceCompanionConfigUpdate(service.serviceCompanionConfigUpdateOmit(input)),
  "companion.model.setActive": async (_deps, input) =>
    service.serviceCompanionModelSetActive(input),
  "companion.model.rename": async (_deps, input) => service.serviceCompanionModelRename(input),
  "companion.model.delete": async (_deps, input) => service.serviceCompanionModelDelete(input),
  "companion.motion.setSlot": async (_deps, input) => service.serviceCompanionMotionSetSlot(input),
  "companion.motion.rename": async (_deps, input) => service.serviceCompanionMotionRename(input),
  "companion.motion.delete": async (_deps, input) => service.serviceCompanionMotionDelete(input),
  "companion.migrate.fromLocal": async (_deps, input) =>
    service.serviceCompanionMigrateFromLocal(input),
  "companion.sync.pull": async () => service.serviceCompanionSyncPull(),
  "companion.asset.get": async (deps, input, ctx) =>
    handleCompanionAssetGet(depsOf(deps), input, ctxOf(ctx)) as unknown as Promise<
      Record<string, unknown>
    >,
  "companion.model.upload": async (deps, input, ctx) =>
    handleCompanionModelUpload(depsOf(deps), input, ctxOf(ctx)),
  "companion.motion.import": async (deps, input, ctx) =>
    handleCompanionMotionImport(depsOf(deps), input, ctxOf(ctx)),
});
