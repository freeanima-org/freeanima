import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { bindHabitatRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";

import { shellQuickMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type ShellQuickRemoteToolsServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

function depsOf(deps: unknown): ShellQuickRemoteToolsServerDeps {
  return deps as ShellQuickRemoteToolsServerDeps;
}

function ctxAuth(ctx: unknown) {
  return (ctx as RemoteToolsRequestContext).auth;
}

export const shellQuickHabitatRoutes = bindHabitatRouteHandlers(shellQuickMethodDefs, {
  "shell_quick.list": async (deps, input, ctx) =>
    service.serviceShellQuickList(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
  "shell_quick.attach": async (deps, input, ctx) =>
    service.serviceShellQuickAttach(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
  "shell_quick.detach": async (deps, input, ctx) =>
    service.serviceShellQuickDetach(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
});
