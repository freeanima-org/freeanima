import { omitUndefined } from "@freeanima/habitat/core/util";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { bindHabitatRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";

import { bookmarkMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type BookmarkRemoteToolsServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

function depsOf(deps: unknown): BookmarkRemoteToolsServerDeps {
  return deps as BookmarkRemoteToolsServerDeps;
}

function ctxAuth(ctx: unknown) {
  return (ctx as RemoteToolsRequestContext).auth;
}

export const bookmarkHabitatRoutes = bindHabitatRouteHandlers(bookmarkMethodDefs, {
  "bookmark.list": async (deps, input, ctx) =>
    service.serviceBookmarkList(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "bookmark.get": async (deps, input, ctx) =>
    service.serviceBookmarkGet(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
  "bookmark.search": async (deps, input, ctx) =>
    service.serviceBookmarkSearch(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "bookmark.create": async (deps, input, ctx) =>
    service.serviceBookmarkCreate(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "bookmark.patch": async (deps, input, ctx) =>
    service.serviceBookmarkPatch(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "bookmark.delete": async (deps, input, ctx) =>
    service.serviceBookmarkDelete(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "bookmark.upsert_batch": async (deps, input, ctx) =>
    service.serviceBookmarkUpsertBatch(
      depsOf(deps).runtime.runtimeDeps(),
      {
        subject_kind: input.subject_kind,
        items: input.items.map((item) => omitUndefined(item)),
      },
      ctxAuth(ctx),
    ),
  "bookmark.sync.pull": async (deps, input, ctx) =>
    service.serviceBookmarkSyncPull(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
});
