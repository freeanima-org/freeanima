import { z } from "zod";

import { capabilityMaskPresetSchema } from "./lifecycle-sap.ts";

export const sapAttachPayloadSchema = z.object({
  app_id: z.string().min(1),
  /** Omitted on first register; present on reconnect/login */
  instance_id: z.string().min(1).optional(),
  instance_label: z.string().optional(),
  features_requested: z.array(z.string()).default([]),
  http_url: z.string().url().optional(),
});

export type SapAttachPayload = z.infer<typeof sapAttachPayloadSchema>;

export const sapAttachOutputSchema = z.object({
  instance_id: z.string().min(1),
  features_enabled: z.array(z.string()),
  server_info: z
    .object({
      anima_version: z.string(),
      hub_rpc_version: z.string(),
      capability_mask: z
        .object({
          presets: z.array(capabilityMaskPresetSchema),
        })
        .optional(),
    })
    .optional(),
});

export type SapAttachOutput = z.infer<typeof sapAttachOutputSchema>;

export const sapDetachPayloadSchema = z.object({});

export type SapDetachPayload = z.infer<typeof sapDetachPayloadSchema>;

export const sapDetachOutputSchema = z.object({ ok: z.literal(true) });

export type SapDetachOutput = z.infer<typeof sapDetachOutputSchema>;
