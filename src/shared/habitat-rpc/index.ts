export {
  HABITAT_RPC_VERSION,
  HABITAT_RPC_VERSION_LEGACY,
  habitatRpcErrorSchema,
  habitatRpcEnvelopeSchema,
  parseHabitatRpcEnvelope,
  serializeHabitatRpcEnvelope,
  hubRpcErrorSchema,
  hubRpcEnvelopeSchema,
  parseHubRpcEnvelope,
  serializeHubRpcEnvelope,
} from "./protocol.ts";
export type {
  HabitatRpcEnvelope,
  HabitatRpcError,
  HubRpcEnvelope,
  HubRpcError,
} from "./protocol.ts";

export {
  habitatRpcConnectPayloadSchema,
  habitatRpcConnectedPayloadSchema,
  heartbeatPayloadSchema,
  hubRpcConnectPayloadSchema,
  hubRpcConnectedPayloadSchema,
} from "./lifecycle.ts";
export type {
  HabitatRpcConnectPayload,
  HabitatRpcConnectedPayload,
  HubRpcConnectPayload,
  HubRpcConnectedPayload,
  HeartbeatPayload,
} from "./lifecycle.ts";

export {
  HABITAT_RPC_CONNECT_TIMEOUT_MS,
  HABITAT_RPC_DEFAULT_REQUEST_TIMEOUT_MS,
  HABITAT_RPC_HEARTBEAT_SEND_CAP_MS,
  HABITAT_RPC_LIVENESS_CHECK_INTERVAL_MS,
  HABITAT_RPC_LIVENESS_SILENCE_MS,
  HABITAT_RPC_MESSAGE_SEND_TIMEOUT_MS,
} from "./constants.ts";

export {
  HabitatRpcTimeoutError,
  isHabitatRpcTimeoutError,
  isHabitatRpcTransportError,
} from "./errors.ts";

export { createRpcClient } from "./client.ts";
export type {
  RpcClient,
  CreateRpcClientOptions,
  RpcRequestHandler,
  RpcRequestOptions,
} from "./client.ts";

export { runHabitatRpcTransport, runHubRpcTransport } from "./transport.ts";
export type {
  HabitatRpcReconnectPolicy,
  RunHabitatRpcTransportOptions,
  HabitatRpcTransportHandle,
  HubRpcReconnectPolicy,
  RunHubRpcTransportOptions,
  HubRpcTransportHandle,
} from "./transport.ts";

export {
  resolveHabitatHttpUrl,
  resolveHabitatRpcWsUrl,
  habitatHttpFromRpcWsUrl,
  habitatHealthProbeUrl,
  habitatRpcRestPrefix,
  HABITAT_RPC_REST_PREFIX,
  HABITAT_RPC_REST_PREFIX_LEGACY,
  isHabitatRpcPathname,
  legacyRpcRedirectLocation,
} from "./urls.ts";

export {
  appendPayloadToQuery,
  buildHabitatRestRequest,
  fetchHabitatRestRaw,
  habitatRestUrl,
  habitatTlsCaDownloadUrl,
  habitatTlsCaInfoUrl,
  isNonJsonHabitatHttpMethod,
  parseHabitatRestResponse,
  parseQueryToPayload,
  throwHabitatRestError,
} from "./http-rest.ts";
export type { BuildHabitatRestRequestOptions, HabitatRestErrorBody } from "./http-rest.ts";

export {
  getBundledHabitatRpcClient,
  whenHabitatRpcReady,
  resetBundledHabitatRpcClientForTests,
  resetBundledHubRpcClientForTests,
  subscribeBundledHabitatRpcConfigChanges,
  subscribeBundledHubRpcConfigChanges,
  subscribeHabitatRpcConnectionState,
  getHabitatRpcConnectionState,
  getHabitatRpcLastInboundAt,
  getHubRpcLastInboundAt,
  reconnectHabitatRpc,
} from "./bundled.ts";
export type {
  BundledHabitatRpcClient,
  BundledHabitatRpcClientOptions,
  BundledHubRpcClient,
  BundledHubRpcClientOptions,
  HabitatRpcConnectionState,
} from "./bundled.ts";
