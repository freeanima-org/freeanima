import type { RemoteToolsServerDeps } from "@freeanima/host/capabilities/outpost/transport/types";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { bindHabitatRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";

import { handleObjectStorageFileGet } from "../binary.ts";
import { objectStorageMethodDefs } from "../method-defs.ts";

function depsOf(deps: unknown): RemoteToolsServerDeps {
  return deps as RemoteToolsServerDeps;
}

function ctxOf(ctx: unknown): RemoteToolsRequestContext {
  return ctx as RemoteToolsRequestContext;
}

export const objectStorageHabitatRoutes = bindHabitatRouteHandlers(objectStorageMethodDefs, {
  "object_storage.file.get": async (deps, input, ctx) =>
    handleObjectStorageFileGet(depsOf(deps), input, ctxOf(ctx)) as unknown as Promise<
      Record<string, unknown>
    >,
});
