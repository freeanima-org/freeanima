import {
  HUB_RPC_VERSION,
  hubRpcErrorSchema,
  parseHubRpcEnvelope,
  serializeHubRpcEnvelope,
  hubRpcConnectPayloadSchema,
  hubRpcConnectedPayloadSchema,
} from "@freeanima/shared/hub-rpc";

export {
  HUB_RPC_VERSION,
  hubRpcErrorSchema,
  parseHubRpcEnvelope,
  serializeHubRpcEnvelope,
  hubRpcConnectPayloadSchema,
  hubRpcConnectedPayloadSchema,
};

export type { HubRpcEnvelope, HubRpcError } from "@freeanima/shared/hub-rpc";

/** @deprecated 使用 HUB_RPC_VERSION */
export const SAP_VERSION = HUB_RPC_VERSION;

export const parseSapEnvelope = parseHubRpcEnvelope;
export const serializeSapEnvelope = serializeHubRpcEnvelope;
export type SapEnvelope = import("@freeanima/shared/hub-rpc").HubRpcEnvelope;
export type SapError = import("@freeanima/shared/hub-rpc").HubRpcError;
