import type { z } from "zod";

import type { HubMethodDef } from "@freeanima/shared/habitat-contract";
import type { FeatureRouteBundle } from "@freeanima/shared/habitat-contract/route.ts";

export type HubRouterBundle = FeatureRouteBundle;

export type InferHubInputs<T> = T extends { defs: infer D extends Record<string, HubMethodDef> }
  ? {
      [K in keyof D & string]: z.infer<D[K]["input"]>;
    }
  : never;

export type InferHubOutputs<T> = T extends { defs: infer D extends Record<string, HubMethodDef> }
  ? {
      [K in keyof D & string]: z.infer<D[K]["output"]>;
    }
  : never;

export type HubMethodFromRouter<T extends HubRouterBundle> = keyof T["defs"] & string;
