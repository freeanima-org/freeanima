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
export const RPC_WIRE_VERSION = HABITAT_RPC_VERSION;

export const parseRpcEnvelope = parseHabitatRpcEnvelope;
export const serializeRpcEnvelope = serializeHabitatRpcEnvelope;
export type RpcEnvelope = import("@freeanima/shared/habitat-rpc").HabitatRpcEnvelope;
export type RpcWireError = import("@freeanima/shared/habitat-rpc").HabitatRpcError;
