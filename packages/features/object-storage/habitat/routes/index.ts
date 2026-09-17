import type { RemoteToolsServerDeps } from "@freeanima/capabilities/outpost/transport/types";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import {
  bindHabitatRouteHandlers,
  asRouteDeps,
  asRouteCtx,
} from "@freeanima/shared/habitat-contract/route.ts";
import { assertNarrow } from "@freeanima/shared/assert-narrow.ts";

import { handleObjectStorageFileGet } from "../binary.ts";
import { objectStorageMethodDefs } from "@freeanima/shared/rpc-contract/feature-rpc/methods/object-storage.ts";

function depsOf(deps: unknown): RemoteToolsServerDeps {
  return asRouteDeps<RemoteToolsServerDeps>(deps);
}

function ctxOf(ctx: unknown): RemoteToolsRequestContext {
  return asRouteCtx<RemoteToolsRequestContext>(ctx);
}

export const objectStorageHabitatRoutes = bindHabitatRouteHandlers(objectStorageMethodDefs, {
  "object_storage.file.get": async (deps, input, ctx) =>
    assertNarrow<Promise<Record<string, unknown>>>(
      handleObjectStorageFileGet(depsOf(deps), input, ctxOf(ctx)),
    ),
});
