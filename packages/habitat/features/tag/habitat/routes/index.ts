import { omitUndefined } from "@freeanima/habitat/core/util";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { bindHabitatRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";

import { tagMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type TagRemoteToolsServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

function depsOf(deps: unknown): TagRemoteToolsServerDeps {
  return deps as TagRemoteToolsServerDeps;
}

function ctxAuth(ctx: unknown) {
  return (ctx as RemoteToolsRequestContext).auth;
}

export const tagHabitatRoutes = bindHabitatRouteHandlers(tagMethodDefs, {
  "tag.list": async (deps, input, ctx) =>
    service.serviceTagList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input), ctxAuth(ctx)),
  "tag.search": async (deps, input, ctx) =>
    service.serviceTagSearch(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "tag.suggest": async (deps, input, ctx) =>
    service.serviceTagSuggest(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "tag.create": async (deps, input, ctx) =>
    service.serviceTagCreate(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "tag.patch": async (deps, input, ctx) =>
    service.serviceTagPatch(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input), ctxAuth(ctx)),
  "tag.delete": async (deps, input, ctx) =>
    service.serviceTagDelete(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
  "tag.setOnEntity": async (deps, input, ctx) =>
    service.serviceTagSetOnEntity(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
});
