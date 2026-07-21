import {
  HABITAT_RPC_VERSION,
  HABITAT_RPC_VERSION_LEGACY,
  habitatRpcErrorSchema,
  parseHabitatRpcEnvelope,
  serializeHabitatRpcEnvelope,
  habitatRpcConnectPayloadSchema,
  habitatRpcConnectedPayloadSchema,
  hubRpcErrorSchema,
  parseHubRpcEnvelope,
  serializeHubRpcEnvelope,
  hubRpcConnectPayloadSchema,
  hubRpcConnectedPayloadSchema,
} from "@freeanima/shared/habitat-rpc";

export {
  HABITAT_RPC_VERSION,
  HABITAT_RPC_VERSION_LEGACY,
  habitatRpcErrorSchema,
  parseHabitatRpcEnvelope,
  serializeHabitatRpcEnvelope,
  habitatRpcConnectPayloadSchema,
  habitatRpcConnectedPayloadSchema,
  hubRpcErrorSchema,
  parseHubRpcEnvelope,
  serializeHubRpcEnvelope,
  hubRpcConnectPayloadSchema,
  hubRpcConnectedPayloadSchema,
};

export type {
  HabitatRpcEnvelope,
  HabitatRpcError,
  HubRpcEnvelope,
  HubRpcError,
} from "@freeanima/shared/habitat-rpc";

/** @deprecated 使用 HABITAT_RPC_VERSION */
export const SAP_VERSION = HABITAT_RPC_VERSION;

export const parseSapEnvelope = parseHabitatRpcEnvelope;
export const serializeSapEnvelope = serializeHabitatRpcEnvelope;
export type SapEnvelope = import("@freeanima/shared/habitat-rpc").HabitatRpcEnvelope;
export type SapError = import("@freeanima/shared/habitat-rpc").HabitatRpcError;
