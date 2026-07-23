import { z } from "zod";

import { HABITAT_RPC_VERSION } from "./protocol.ts";

const habitatRpcProtocolSchema = z.literal(HABITAT_RPC_VERSION);

export const habitatRpcConnectPayloadSchema = z.object({
  protocol: habitatRpcProtocolSchema,
  auth_token: z.string().min(1),
});

export type HabitatRpcConnectPayload = z.infer<typeof habitatRpcConnectPayloadSchema>;

export const habitatRpcConnectedPayloadSchema = z.object({
  protocol: habitatRpcProtocolSchema,
  session_id: z.string().min(1),
  heartbeat_interval_sec: z.number().int().positive(),
});

export type HabitatRpcConnectedPayload = z.infer<typeof habitatRpcConnectedPayloadSchema>;

export const heartbeatPayloadSchema = z.object({
  ts: z.number().optional(),
});

export type HeartbeatPayload = z.infer<typeof heartbeatPayloadSchema>;
