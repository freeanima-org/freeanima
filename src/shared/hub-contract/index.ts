export type { HubClientProfile, HubMethodMeta, TransportKind, HttpRouteMeta } from "./transport.ts";
export { resolveDefaultTransport, resolveFallbackTransport } from "./transport.ts";

export type { HubMethodDef, DualTransportMetaOptions } from "./method-def.ts";
export { defineHubMethod, dualTransportMeta, httpTransportMeta, wsOnlyMeta } from "./method-def.ts";

export {
  buildHttpRouteMeta,
  HTTP_ROUTE_OVERRIDES,
  isReadOnlyHubMeta,
  coercePayloadForSchema,
} from "./http-route.ts";

export {
  METHOD_REGISTRY,
  getHubMethodDef,
  getHubMethodHttpRoute,
  isHubMethod,
  listHubMethods,
  type HubMethod,
  type HubMethodInputs,
  type HubMethodOutputs,
} from "./registry/index.ts";

export * from "./schemas/console-schemas.ts";
