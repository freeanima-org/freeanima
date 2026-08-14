import { omitUndefined } from "@freeanima/habitat/core/util";
import { bindHabitatRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";

import { codingMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type CodingRemoteToolsServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

function depsOf(deps: unknown): CodingRemoteToolsServerDeps {
  return deps as CodingRemoteToolsServerDeps;
}

export const codingHabitatRoutes = bindHabitatRouteHandlers(codingMethodDefs, {
  "coding.noteCreate": async (deps, input, _ctx) =>
    service.serviceCodingNoteCreate(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "coding.noteList": async (deps, input, _ctx) =>
    service.serviceCodingNoteList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "coding.projectContextSync": async (deps, input, _ctx) =>
    service.serviceProjectContextSync(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
});
