export type {
  HabitatClientProfile,
  HabitatMethodMeta,
  TransportKind,
  HttpRouteMeta,
  HttpRequestEncoding,
  HttpResponseEncoding,
  HabitatAuthPolicy,
} from "./transport.ts";
export {
  resolveDefaultTransport,
  resolveFallbackTransport,
  resolveHabitatAuthPolicy,
  resolveHttpRequestEncoding,
  resolveHttpResponseEncoding,
} from "./transport.ts";

export type {
  HabitatMethodDef,
  DualTransportMetaOptions,
  BinaryHttpMetaOptions,
} from "./method-def.ts";
export {
  defineHabitatMethod,
  dualTransportMeta,
  httpTransportMeta,
  wsOnlyMeta,
  publicHttpMeta,
  rawPublicHttpMeta,
  binaryHttpMeta,
} from "./method-def.ts";

export {
  defineHabitatRoute,
  defineHabitatRouteFromDef,
  mergeFeatureRoutes,
  mergeHabitatRouteBundles,
  bindHabitatRouteHandlers,
  type HabitatRouteBundle,
  type HabitatRouteHandler,
  type HabitatRouteHandlersForDefs,
  type FeatureRouteBundle,
} from "./route.ts";

export {
  buildHttpRouteMeta,
  HTTP_ROUTE_OVERRIDES,
  isReadOnlyHabitatMeta,
  coercePayloadForSchema,
} from "./http-route.ts";

export {
  getHabitatMethodDef,
  getHabitatMethodHttpRoute,
  isHabitatMethod,
  listHabitatMethods,
  type HabitatMethod,
  type HabitatMethodInputs,
  type HabitatMethodOutputs,
} from "./registry/index.ts";

export * from "./schemas/habitat-schemas.ts";
