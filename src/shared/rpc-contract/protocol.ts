import {
  HABITAT_RPC_VERSION,
  habitatRpcErrorSchema,
  parseHabitatRpcEnvelope,
  serializeHabitatRpcEnvelope,
  habitatRpcConnectPayloadSchema,
  habitatRpcConnectedPayloadSchema,
} from "@freeanima/shared/habitat-rpc";

export {
  HABITAT_RPC_VERSION,
  habitatRpcErrorSchema,
  parseHabitatRpcEnvelope,
  serializeHabitatRpcEnvelope,
  habitatRpcConnectPayloadSchema,
  habitatRpcConnectedPayloadSchema,
};

export type { HabitatRpcEnvelope, HabitatRpcError } from "@freeanima/shared/habitat-rpc";

/** @deprecated 使用 HABITAT_RPC_VERSION */
export const RPC_PROTOCOL_VERSION = HABITAT_RPC_VERSION;

export const parseRpcEnvelope = parseHabitatRpcEnvelope;
export const serializeRpcEnvelope = serializeHabitatRpcEnvelope;
export type RpcEnvelope = import("@freeanima/shared/habitat-rpc").HabitatRpcEnvelope;
export type RpcProtocolError = import("@freeanima/shared/habitat-rpc").HabitatRpcError;
