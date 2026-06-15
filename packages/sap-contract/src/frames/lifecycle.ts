import { z } from "zod";

import { SAP_VERSION } from "../protocol.ts";

export const connectPayloadSchema = z.object({
  app_id: z.string().min(1),
  instance_id: z.string().min(1),
  instance_label: z.string().optional(),
  protocol: z.literal(SAP_VERSION),
  features_requested: z.array(z.string()).default([]),
});

export type ConnectPayload = z.infer<typeof connectPayloadSchema>;

export const connectedPayloadSchema = z.object({
  protocol: z.literal(SAP_VERSION),
  features_enabled: z.array(z.string()),
  server_info: z
    .object({
      anima_version: z.string(),
      sap_version: z.string(),
      platform_for_app: z.record(z.string(), z.string()),
    })
    .optional(),
  heartbeat_interval_sec: z.number().int().positive(),
});

export type ConnectedPayload = z.infer<typeof connectedPayloadSchema>;

export const heartbeatPayloadSchema = z.object({
  ts: z.number().optional(),
});

export type HeartbeatPayload = z.infer<typeof heartbeatPayloadSchema>;
