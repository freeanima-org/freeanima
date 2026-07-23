import { omitUndefined } from "@freeanima/core/util";
import { bindHabitatRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";

import { diaryMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type DiaryRemoteToolsServerDeps = {
  runtime: { runtimeDeps(): RuntimeDeps };
};

function depsOf(deps: unknown): DiaryRemoteToolsServerDeps {
  return deps as DiaryRemoteToolsServerDeps;
}

export const diaryHabitatRoutes = bindHabitatRouteHandlers(diaryMethodDefs, {
  "diary.list": async (deps, input) =>
    service.serviceDiaryList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "diary.create": async (deps, input) =>
    service.serviceDiaryCreate(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "diary.append": async (deps, input) =>
    service.serviceDiaryAppend(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "diary.patch": async (deps, input) =>
    service.serviceDiaryPatch(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "diary.delete": async (deps, input) =>
    service.serviceDiaryDelete(depsOf(deps).runtime.runtimeDeps(), input),
  "diary.get": async (deps, input) =>
    service.serviceDiaryGet(depsOf(deps).runtime.runtimeDeps(), input),
  "diary.search": async (deps, input) =>
    service.serviceDiarySearch(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "diary.blockCreate": async (deps, input) =>
    service.serviceDiaryBlockCreate(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "diary.blockPatch": async (deps, input) =>
    service.serviceDiaryBlockPatch(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "diary.blockDelete": async (deps, input) =>
    service.serviceDiaryBlockDelete(depsOf(deps).runtime.runtimeDeps(), input),
  "diary.blockReorder": async (deps, input) =>
    service.serviceDiaryBlockReorder(depsOf(deps).runtime.runtimeDeps(), input),
  "diary.templateList": async (deps, input) =>
    service.serviceDiaryTemplateList(depsOf(deps).runtime.runtimeDeps(), input),
  "diary.templateCreate": async (deps, input) =>
    service.serviceDiaryTemplateCreate(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "diary.templatePatch": async (deps, input) =>
    service.serviceDiaryTemplatePatch(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "diary.templateDelete": async (deps, input) =>
    service.serviceDiaryTemplateDelete(depsOf(deps).runtime.runtimeDeps(), input),
  "diary.suggestTags": async (deps, input) =>
    service.serviceDiarySuggestTags(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
});
