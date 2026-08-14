export {
  HABITAT_RPC_VERSION,
  habitatRpcErrorSchema,
  habitatRpcEnvelopeSchema,
  parseHabitatRpcEnvelope,
  serializeHabitatRpcEnvelope,
} from "./protocol.ts";
export type { HabitatRpcEnvelope, HabitatRpcError } from "./protocol.ts";

export {
  habitatRpcConnectPayloadSchema,
  habitatRpcConnectedPayloadSchema,
  heartbeatPayloadSchema,
} from "./lifecycle.ts";
export type {
  HabitatRpcConnectPayload,
  HabitatRpcConnectedPayload,
  HeartbeatPayload,
} from "./lifecycle.ts";

export {
  HABITAT_RPC_CONNECT_TIMEOUT_MS,
  HABITAT_RPC_DEFAULT_REQUEST_TIMEOUT_MS,
  HABITAT_RPC_READ_TIMEOUT_MS,
  HABITAT_RPC_WRITE_TIMEOUT_MS,
  HABITAT_RPC_LONG_TIMEOUT_MS,
  HABITAT_RPC_BINARY_TRANSFER_TIMEOUT_MS,
  HABITAT_RPC_EMAIL_IMAP_TIMEOUT_MS,
  HABITAT_RPC_EMAIL_SYNC_TIMEOUT_MS,
  HABITAT_RPC_BULK_IMPORT_TIMEOUT_MS,
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

export { runHabitatRpcTransport } from "./transport.ts";
export type {
  HabitatRpcReconnectPolicy,
  RunHabitatRpcTransportOptions,
  HabitatRpcTransportHandle,
} from "./transport.ts";

export {
  resolveHabitatHttpUrl,
  resolveHabitatRpcWsUrl,
  habitatHttpFromRpcWsUrl,
  habitatHealthProbeUrl,
  habitatRpcRestPrefix,
  HABITAT_RPC_REST_PREFIX,
  isHabitatRpcPathname,
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
