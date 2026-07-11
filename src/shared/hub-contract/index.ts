export type {
  HubClientProfile,
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
  HubMethodDef,
  DualTransportMetaOptions,
  BinaryHttpMetaOptions,
} from "./method-def.ts";
export {
  defineHubMethod,
  dualTransportMeta,
  httpTransportMeta,
  wsOnlyMeta,
  publicHttpMeta,
  rawPublicHttpMeta,
  binaryHttpMeta,
} from "./method-def.ts";

export {
  defineHubRoute,
  mergeFeatureRoutes,
  mergeHubRouteBundles,
  attachHandlersToDefs,
  type HubRouteBundle,
  type HubRouteHandler,
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

export * from "./schemas/console-schemas.ts";
