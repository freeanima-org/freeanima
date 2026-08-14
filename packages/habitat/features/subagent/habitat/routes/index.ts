import { omitUndefined } from "@freeanima/habitat/core/util";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { bindHabitatRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";

import { subagentMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type SubagentRemoteToolsServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

function depsOf(deps: unknown): SubagentRemoteToolsServerDeps {
  return deps as SubagentRemoteToolsServerDeps;
}

function ctxAuth(ctx: unknown) {
  return (ctx as RemoteToolsRequestContext).auth;
}

export const subagentHabitatRoutes = bindHabitatRouteHandlers(subagentMethodDefs, {
  "subagent.list": async (deps, input, ctx) =>
    service.serviceSubagentList(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "subagent.get": async (deps, input, ctx) =>
    service.serviceSubagentGet(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "subagent.create": async (deps, input, ctx) =>
    service.serviceSubagentCreate(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "subagent.patch": async (deps, input, ctx) =>
    service.serviceSubagentPatch(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "subagent.delete": async (deps, input, ctx) =>
    service.serviceSubagentDelete(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
});
