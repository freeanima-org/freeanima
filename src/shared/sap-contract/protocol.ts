import {
  HABITAT_RPC_VERSION,
  hubRpcErrorSchema,
  parseHubRpcEnvelope,
  serializeHubRpcEnvelope,
  hubRpcConnectPayloadSchema,
  hubRpcConnectedPayloadSchema,
} from "@freeanima/shared/habitat-rpc";

export {
  HABITAT_RPC_VERSION,
  hubRpcErrorSchema,
  parseHubRpcEnvelope,
  serializeHubRpcEnvelope,
  hubRpcConnectPayloadSchema,
  hubRpcConnectedPayloadSchema,
};

export type { HubRpcEnvelope, HubRpcError } from "@freeanima/shared/habitat-rpc";

/** @deprecated 使用 HABITAT_RPC_VERSION */
export const SAP_VERSION = HABITAT_RPC_VERSION;

export const parseSapEnvelope = parseHubRpcEnvelope;
export const serializeSapEnvelope = serializeHubRpcEnvelope;
export type SapEnvelope = import("@freeanima/shared/habitat-rpc").HubRpcEnvelope;
export type SapError = import("@freeanima/shared/habitat-rpc").HubRpcError;
