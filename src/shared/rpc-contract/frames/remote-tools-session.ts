import { z } from "zod";

export const remoteToolsAttachPayloadSchema = z.object({
  app_id: z.string().min(1),
  /** Omitted on first register; present on reconnect/login */
  instance_id: z.string().min(1).optional(),
  instance_label: z.string().optional(),
  features_requested: z.array(z.string()).default([]),
  http_url: z.string().url().optional(),
});

export type RemoteToolsAttachPayload = z.infer<typeof remoteToolsAttachPayloadSchema>;

export const remoteToolsAttachOutputSchema = z.object({
  instance_id: z.string().min(1),
  features_enabled: z.array(z.string()),
  server_info: z
    .object({
      anima_version: z.string(),
      habitat_rpc_version: z.string().optional(),
    })
    .refine((info) => info.habitat_rpc_version != null, {
      message: "server_info requires habitat_rpc_version",
    })
    .optional(),
});

export type RemoteToolsAttachOutput = z.infer<typeof remoteToolsAttachOutputSchema>;

export const remoteToolsDetachPayloadSchema = z.object({});

export type RemoteToolsDetachPayload = z.infer<typeof remoteToolsDetachPayloadSchema>;

export const remoteToolsDetachOutputSchema = z.object({ ok: z.literal(true) });

export type RemoteToolsDetachOutput = z.infer<typeof remoteToolsDetachOutputSchema>;
