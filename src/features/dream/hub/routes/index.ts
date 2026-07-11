import { omitUndefined } from "@freeanima/core/util";
import { dualTransportMeta } from "@freeanima/shared/hub-contract";
import { defineHubRoute, mergeFeatureRoutes } from "@freeanima/shared/hub-contract/route.ts";
import {
  dreamGetInputSchema,
  dreamGetOutputSchema,
  dreamListInputSchema,
  dreamListOutputSchema,
} from "@freeanima/shared/sap-contract/frames/dream";

import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type DreamSapServerDeps = {
  runtime: { runtimeDeps(): RuntimeDeps };
};

function depsOf(deps: unknown): DreamSapServerDeps {
  return deps as DreamSapServerDeps;
}

export const dreamHubRoutes = mergeFeatureRoutes([
  defineHubRoute({
    method: "dream.list",
    input: dreamListInputSchema,
    output: dreamListOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input) =>
      service.serviceDreamList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  }),
  defineHubRoute({
    method: "dream.get",
    input: dreamGetInputSchema,
    output: dreamGetOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input) =>
      service.serviceDreamGet(depsOf(deps).runtime.runtimeDeps(), input),
  }),
]);
