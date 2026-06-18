import { z } from "zod";

import { SAP_VERSION } from "../protocol.ts";

export const connectPayloadSchema = z.object({
  app_id: z.string().min(1),
  /** Omitted on first register; present on reconnect/login */
  instance_id: z.string().min(1).optional(),
  instance_label: z.string().optional(),
  protocol: z.literal(SAP_VERSION),
  features_requested: z.array(z.string()).default([]),
  http_url: z.string().url().optional(),
});

export type ConnectPayload = z.infer<typeof connectPayloadSchema>;

export const capabilityMaskPresetSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  allowed_tools_summary: z.array(z.string()).optional(),
});

export const connectedPayloadSchema = z.object({
  protocol: z.literal(SAP_VERSION),
  /** Hub-assigned or confirmed instance id (always present) */
  instance_id: z.string().min(1),
  features_enabled: z.array(z.string()),
  server_info: z
    .object({
      anima_version: z.string(),
      sap_version: z.string(),
      capability_mask: z
        .object({
          presets: z.array(capabilityMaskPresetSchema),
        })
        .optional(),
    })
    .optional(),
  heartbeat_interval_sec: z.number().int().positive(),
});

export type ConnectedPayload = z.infer<typeof connectedPayloadSchema>;

export const heartbeatPayloadSchema = z.object({
  ts: z.number().optional(),
});

export type HeartbeatPayload = z.infer<typeof heartbeatPayloadSchema>;
