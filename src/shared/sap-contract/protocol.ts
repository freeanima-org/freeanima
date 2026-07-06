import {
  HUB_RPC_VERSION,
  hubRpcErrorSchema,
  parseHubRpcEnvelope,
  serializeHubRpcEnvelope,
  hubRpcConnectPayloadSchema,
  hubRpcConnectedPayloadSchema,
} from "@freeanima/hub-rpc";

export {
  HUB_RPC_VERSION,
  hubRpcErrorSchema,
  parseHubRpcEnvelope,
  serializeHubRpcEnvelope,
  hubRpcConnectPayloadSchema,
  hubRpcConnectedPayloadSchema,
};

export type { HubRpcEnvelope, HubRpcError } from "@freeanima/hub-rpc";

/** @deprecated 使用 HUB_RPC_VERSION */
export const SAP_VERSION = HUB_RPC_VERSION;

export const parseSapEnvelope = parseHubRpcEnvelope;
export const serializeSapEnvelope = serializeHubRpcEnvelope;
export type SapEnvelope = import("@freeanima/hub-rpc").HubRpcEnvelope;
export type SapError = import("@freeanima/hub-rpc").HubRpcError;
