import { z } from "zod";

import { HABITAT_RPC_VERSION } from "./protocol.ts";

export const hubRpcConnectPayloadSchema = z.object({
  protocol: z.literal(HABITAT_RPC_VERSION),
  auth_token: z.string().min(1),
});

export type HubRpcConnectPayload = z.infer<typeof hubRpcConnectPayloadSchema>;

export const hubRpcConnectedPayloadSchema = z.object({
  protocol: z.literal(HABITAT_RPC_VERSION),
  session_id: z.string().min(1),
  heartbeat_interval_sec: z.number().int().positive(),
});

export type HubRpcConnectedPayload = z.infer<typeof hubRpcConnectedPayloadSchema>;

export const heartbeatPayloadSchema = z.object({
  ts: z.number().optional(),
});

export type HeartbeatPayload = z.infer<typeof heartbeatPayloadSchema>;
