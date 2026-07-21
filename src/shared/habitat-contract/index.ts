export type {
  HabitatClientProfile,
  HubMethodMeta,
  TransportKind,
  HttpRouteMeta,
  HttpRequestEncoding,
  HttpResponseEncoding,
  HubAuthPolicy,
} from "./transport.ts";
export {
  resolveDefaultTransport,
  resolveFallbackTransport,
  resolveHubAuthPolicy,
  resolveHttpRequestEncoding,
  resolveHttpResponseEncoding,
} from "./transport.ts";

export type {
  HabitatMethodDef,
  HubMethodDef,
  DualTransportMetaOptions,
  BinaryHttpMetaOptions,
} from "./method-def.ts";
export {
  defineHabitatMethod,
  defineHubMethod,
  dualTransportMeta,
  httpTransportMeta,
  wsOnlyMeta,
  publicHttpMeta,
  rawPublicHttpMeta,
  binaryHttpMeta,
} from "./method-def.ts";

export {
  defineHabitatRoute,
  defineHubRoute,
  defineHabitatRouteFromDef,
  defineHubRouteFromDef,
  mergeFeatureRoutes,
  mergeHabitatRouteBundles,
  mergeHubRouteBundles,
  bindHabitatRouteHandlers,
  bindHubRouteHandlers,
  type HabitatRouteBundle,
  type HubRouteBundle,
  type HabitatRouteHandler,
  type HubRouteHandler,
  type HabitatRouteHandlersForDefs,
  type HubRouteHandlersForDefs,
  type FeatureRouteBundle,
} from "./route.ts";

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

export * from "./schemas/habitat-schemas.ts";
