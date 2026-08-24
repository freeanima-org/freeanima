import { z } from "zod";

import { HABITAT_INSTANCE_ID_PREFIX } from "@freeanima/shared/identity";

const habitatInstanceIdSchema = z
  .string()
  .min(1)
  .refine((v) => v.startsWith(HABITAT_INSTANCE_ID_PREFIX), {
    message: `habitat_instance_id must start with ${HABITAT_INSTANCE_ID_PREFIX}`,
  });

export const federationSatelliteStatusSchema = z.enum(["pending", "trusted", "revoked"]);

export const federationSatelliteRowSchema = z.object({
  satellite_habitat_instance_id: habitatInstanceIdSchema,
  satellite_public_key: z.string().min(1),
  label: z.string().nullable(),
  status: federationSatelliteStatusSchema,
  linked_contact_id: z.number().int().positive().nullable(),
  created_at: z.string(),
  trusted_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
  /** Hub 内存态：当前是否在线 */
  online: z.boolean().optional(),
});

export const federationConnectionStateSchema = z.enum([
  "disconnected",
  "connecting",
  "connected",
  "pending_approval",
  "reconnecting",
]);

export const federationStatusOutputSchema = z.object({
  role: z.enum(["disabled", "hub", "satellite"]),
  enabled: z.boolean(),
  hub_origin: z.string().nullable(),
  hub_instance_id: z.string().nullable(),
  connection_state: federationConnectionStateSchema.nullable(),
  federation_ws_path: z.string(),
});

export const federationSatelliteListInputSchema = z.object({});
export const federationSatelliteListOutputSchema = z.object({
  items: z.array(federationSatelliteRowSchema),
});

export const federationSatelliteCreateInputSchema = z.object({
  satellite_habitat_instance_id: habitatInstanceIdSchema,
  satellite_public_key: z.string().min(1),
  label: z.string().min(1).optional(),
  linked_contact_id: z.number().int().positive().optional(),
  /** 为 true 且未传 linked_contact_id 时，在 Commons 新建 external anima 联系人并回填 */
  create_contact: z.boolean().optional(),
});

export const federationSatelliteCreateOutputSchema = z.object({
  item: federationSatelliteRowSchema,
});

export const federationSatelliteRevokeInputSchema = z.object({
  satellite_habitat_instance_id: habitatInstanceIdSchema,
});

export const federationSatelliteRevokeOutputSchema = z.object({
  ok: z.literal(true),
});

export const federationSatelliteApproveInputSchema = z.object({
  satellite_habitat_instance_id: habitatInstanceIdSchema,
  label: z.string().min(1).optional(),
  create_contact: z.boolean().optional(),
});

export const federationSatelliteApproveOutputSchema = z.object({
  item: federationSatelliteRowSchema,
});

export const federationSatelliteRejectInputSchema = z.object({
  satellite_habitat_instance_id: habitatInstanceIdSchema,
});

export const federationSatelliteRejectOutputSchema = z.object({
  ok: z.literal(true),
});

export const federationPingInputSchema = z.object({
  message: z.string().optional(),
});

export const federationPingOutputSchema = z.object({
  pong: z.string(),
  habitat_instance_id: z.string(),
  role: z.enum(["hub", "satellite"]),
});

export const federationHandshakeHelloSchema = z.object({
  habitat_instance_id: habitatInstanceIdSchema,
  public_key: z.string().min(1),
  nonce: z.string().min(1),
  signature: z.string().min(1),
});

export const federationTrustStateSchema = z.enum(["trusted", "pending"]);

export const federationHandshakeAckSchema = z.object({
  habitat_instance_id: habitatInstanceIdSchema,
  public_key: z.string().min(1),
  nonce: z.string().min(1),
  echo_nonce: z.string().min(1),
  signature: z.string().min(1),
  trust_state: federationTrustStateSchema,
});
