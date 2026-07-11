import type { z } from "zod";

import type { HubMethodDef } from "@freeanima/shared/hub-contract";
import type { FeatureRouteBundle } from "@freeanima/shared/hub-contract/route.ts";

export type HubRouterBundle = FeatureRouteBundle;

export type InferHubInputs<T extends HubRouterBundle> = {
  [K in keyof T["defs"] & string]: z.infer<T["defs"][K]["input"]>;
};

export type InferHubOutputs<T extends HubRouterBundle> = {
  [K in keyof T["defs"] & string]: z.infer<T["defs"][K]["output"]>;
};

export type HubMethodFromRouter<T extends HubRouterBundle> = keyof T["defs"] & string;

/** defs-only bundle（ws-only / mcp 等无 feature handler 的 method） */
export function defsOnlyBundle(defs: Record<string, HubMethodDef>): FeatureRouteBundle {
  return { handlers: {}, defs };
}
