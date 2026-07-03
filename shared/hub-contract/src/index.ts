export type {
  HubClientProfile,
  HubHttpBinding,
  HubMethodMeta,
  TransportKind,
} from "./transport.ts";
export { resolveDefaultTransport, resolveFallbackTransport } from "./transport.ts";

export type { HubMethodDef } from "./method-def.ts";
export { defineHubMethod, dualCrudMeta, httpOnlyMeta, wsOnlyMeta } from "./method-def.ts";

export {
  METHOD_REGISTRY,
  getHubMethodDef,
  isHubMethod,
  listHubMethods,
  type HubMethod,
  type HubMethodInputs,
  type HubMethodOutputs,
} from "./registry/index.ts";

export * from "./schemas/console-schemas.ts";
