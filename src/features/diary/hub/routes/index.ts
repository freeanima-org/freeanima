import { omitUndefined } from "@freeanima/core/util";
import { bindHubRouteHandlers } from "@freeanima/shared/hub-contract/route.ts";

import { diaryMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type DiarySapServerDeps = {
  runtime: { runtimeDeps(): RuntimeDeps };
};

function depsOf(deps: unknown): DiarySapServerDeps {
  return deps as DiarySapServerDeps;
}

export const diaryHubRoutes = bindHubRouteHandlers(diaryMethodDefs, {
  "diary.list": async (deps, input) =>
    service.serviceDiaryList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "diary.create": async (deps, input) =>
    service.serviceDiaryCreate(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "diary.append": async (deps, input) =>
    service.serviceDiaryAppend(depsOf(deps).runtime.runtimeDeps(), input),
  "diary.patch": async (deps, input) =>
    service.serviceDiaryPatch(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "diary.delete": async (deps, input) =>
    service.serviceDiaryDelete(depsOf(deps).runtime.runtimeDeps(), input),
  "diary.get": async (deps, input) =>
    service.serviceDiaryGet(depsOf(deps).runtime.runtimeDeps(), input),
  "diary.search": async (deps, input) =>
    service.serviceDiarySearch(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
});
