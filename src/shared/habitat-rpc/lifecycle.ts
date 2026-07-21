import { z } from "zod";

import { HABITAT_RPC_VERSION, HABITAT_RPC_VERSION_LEGACY } from "./protocol.ts";

const habitatRpcProtocolSchema = z.union([
  z.literal(HABITAT_RPC_VERSION),
  z.literal(HABITAT_RPC_VERSION_LEGACY),
]);

export const habitatRpcConnectPayloadSchema = z.object({
  protocol: habitatRpcProtocolSchema,
  auth_token: z.string().min(1),
});

/** @deprecated 使用 {@link habitatRpcConnectPayloadSchema} */
export const hubRpcConnectPayloadSchema = habitatRpcConnectPayloadSchema;

export type HabitatRpcConnectPayload = z.infer<typeof habitatRpcConnectPayloadSchema>;

/** @deprecated 使用 {@link HabitatRpcConnectPayload} */
export type HubRpcConnectPayload = HabitatRpcConnectPayload;

export const habitatRpcConnectedPayloadSchema = z.object({
  protocol: habitatRpcProtocolSchema,
  session_id: z.string().min(1),
  heartbeat_interval_sec: z.number().int().positive(),
});

/** @deprecated 使用 {@link habitatRpcConnectedPayloadSchema} */
export const hubRpcConnectedPayloadSchema = habitatRpcConnectedPayloadSchema;

export type HabitatRpcConnectedPayload = z.infer<typeof habitatRpcConnectedPayloadSchema>;

/** @deprecated 使用 {@link HabitatRpcConnectedPayload} */
export type HubRpcConnectedPayload = HabitatRpcConnectedPayload;

export const heartbeatPayloadSchema = z.object({
  ts: z.number().optional(),
});

export type HeartbeatPayload = z.infer<typeof heartbeatPayloadSchema>;
