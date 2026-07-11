import { omitUndefined } from "@freeanima/core/util";
import { dualTransportMeta } from "@freeanima/shared/hub-contract";
import { defineHubRoute, mergeFeatureRoutes } from "@freeanima/shared/hub-contract/route.ts";
import {
  diaryAppendInputSchema,
  diaryAppendOutputSchema,
  diaryCreateInputSchema,
  diaryCreateOutputSchema,
  diaryDeleteInputSchema,
  diaryDeleteOutputSchema,
  diaryGetInputSchema,
  diaryGetOutputSchema,
  diaryListInputSchema,
  diaryListOutputSchema,
  diaryPatchInputSchema,
  diaryPatchOutputSchema,
  diarySearchInputSchema,
  diarySearchOutputSchema,
} from "@freeanima/shared/sap-contract/frames/diary";

import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type DiarySapServerDeps = {
  runtime: { runtimeDeps(): RuntimeDeps };
};

function depsOf(deps: unknown): DiarySapServerDeps {
  return deps as DiarySapServerDeps;
}

export const diaryHubRoutes = mergeFeatureRoutes([
  defineHubRoute({
    method: "diary.list",
    input: diaryListInputSchema,
    output: diaryListOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input) =>
      service.serviceDiaryList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  }),
  defineHubRoute({
    method: "diary.create",
    input: diaryCreateInputSchema,
    output: diaryCreateOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input) =>
      service.serviceDiaryCreate(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  }),
  defineHubRoute({
    method: "diary.append",
    input: diaryAppendInputSchema,
    output: diaryAppendOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input) =>
      service.serviceDiaryAppend(depsOf(deps).runtime.runtimeDeps(), input),
  }),
  defineHubRoute({
    method: "diary.patch",
    input: diaryPatchInputSchema,
    output: diaryPatchOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input) =>
      service.serviceDiaryPatch(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  }),
  defineHubRoute({
    method: "diary.delete",
    input: diaryDeleteInputSchema,
    output: diaryDeleteOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input) =>
      service.serviceDiaryDelete(depsOf(deps).runtime.runtimeDeps(), input),
  }),
  defineHubRoute({
    method: "diary.get",
    input: diaryGetInputSchema,
    output: diaryGetOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input) =>
      service.serviceDiaryGet(depsOf(deps).runtime.runtimeDeps(), input),
  }),
  defineHubRoute({
    method: "diary.search",
    input: diarySearchInputSchema,
    output: diarySearchOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input) =>
      service.serviceDiarySearch(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  }),
]);
