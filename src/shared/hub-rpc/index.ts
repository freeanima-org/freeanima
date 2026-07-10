export {
  HUB_RPC_VERSION,
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
  HUB_RPC_CONNECT_TIMEOUT_MS,
  HUB_RPC_DEFAULT_REQUEST_TIMEOUT_MS,
  HUB_RPC_HEARTBEAT_SEND_CAP_MS,
  HUB_RPC_LIVENESS_CHECK_INTERVAL_MS,
  HUB_RPC_LIVENESS_SILENCE_MS,
  HUB_RPC_MESSAGE_SEND_TIMEOUT_MS,
} from "./constants.ts";

export { HubRpcTimeoutError, isHubRpcTimeoutError, isHubRpcTransportError } from "./errors.ts";

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

export { resolveHubHttpUrl, resolveHubRpcWsUrl, hubHttpFromRpcWsUrl } from "./urls.ts";

export {
  appendPayloadToQuery,
  buildHubRestRequest,
  hubHealthProbeUrl,
  hubRpcRestPrefix,
  hubTlsCaInfoUrl,
  parseHubRestResponse,
  parseQueryToPayload,
} from "./http-rest.ts";
export type { HubRestErrorBody } from "./http-rest.ts";

export {
  getBundledHubRpcClient,
  whenHubRpcReady,
  resetBundledHubRpcClientForTests,
  subscribeBundledHubRpcConfigChanges,
  subscribeHubRpcConnectionState,
  getHubRpcConnectionState,
  getHubRpcLastInboundAt,
  reconnectHubRpc,
} from "./bundled.ts";
export type {
  BundledHubRpcClient,
  BundledHubRpcClientOptions,
  HubRpcConnectionState,
} from "./bundled.ts";
