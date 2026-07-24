import type { z } from "zod";

import type { HabitatMethodDef } from "@freeanima/shared/habitat-contract";
import type { FeatureRouteBundle } from "@freeanima/shared/habitat-contract/route.ts";

export type HabitatRouterBundle = FeatureRouteBundle;

export type InferHabitatInputs<T> = T extends {
  defs: infer D extends Record<string, HabitatMethodDef>;
}
  ? {
      [K in keyof D & string]: z.infer<D[K]["input"]>;
    }
  : never;

export type InferHabitatOutputs<T> = T extends {
  defs: infer D extends Record<string, HabitatMethodDef>;
}
  ? {
      [K in keyof D & string]: z.infer<D[K]["output"]>;
    }
  : never;

export type HabitatMethodFromRouter<T extends HabitatRouterBundle> = keyof T["defs"] & string;
