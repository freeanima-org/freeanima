export {
  HABITAT_RPC_VERSION,
  hubRpcErrorSchema,
  parseHubRpcEnvelope,
  serializeHubRpcEnvelope,
} from "./protocol.ts";
export type { HubRpcEnvelope, HubRpcError } from "./protocol.ts";

export {
  hubRpcConnectPayloadSchema,
  hubRpcConnectedPayloadSchema,
  heartbeatPayloadSchema,
} from "./lifecycle.ts";
export type {
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

export { runHubRpcTransport } from "./transport.ts";
export type {
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
  resetBundledHubRpcClientForTests,
  subscribeBundledHubRpcConfigChanges,
  subscribeHabitatRpcConnectionState,
  getHabitatRpcConnectionState,
  getHubRpcLastInboundAt,
  reconnectHabitatRpc,
} from "./bundled.ts";
export type {
  BundledHubRpcClient,
  BundledHubRpcClientOptions,
  HabitatRpcConnectionState,
} from "./bundled.ts";
