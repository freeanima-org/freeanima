import { omitUndefined } from "@freeanima/core/util";
import { bindHubRouteHandlers } from "@freeanima/shared/hub-contract/route.ts";

import { dreamMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type DreamSapServerDeps = {
  runtime: { runtimeDeps(): RuntimeDeps };
};

function depsOf(deps: unknown): DreamSapServerDeps {
  return deps as DreamSapServerDeps;
}

export const dreamHubRoutes = bindHubRouteHandlers(dreamMethodDefs, {
  "dream.list": async (deps, input) =>
    service.serviceDreamList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "dream.get": async (deps, input) =>
    service.serviceDreamGet(depsOf(deps).runtime.runtimeDeps(), input),
});
