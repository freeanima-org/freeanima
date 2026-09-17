import { z } from "zod";

import { HABITAT_INSTANCE_ID_PREFIX } from "@freeanima/shared/identity";
import { parsePublicOrigin } from "./public.ts";

const habitatInstanceIdSchema = z
  .string()
  .min(HABITAT_INSTANCE_ID_PREFIX.length + 1)
  .refine((v) => v.startsWith(HABITAT_INSTANCE_ID_PREFIX), {
    message: `须以 ${HABITAT_INSTANCE_ID_PREFIX} 开头`,
  });

const hubOriginFieldSchema = z
  .string()
  .min(1)
  .transform((raw, ctx) => {
    const origin = parsePublicOrigin(raw);
    if (!origin) {
      ctx.addIssue({
        code: "custom",
        message: "须为绝对 origin（如 https://anima.example.com）",
      });
      return z.NEVER;
    }
    return origin;
  });

export const federationHubConfigSchema = z.object({
  origin: hubOriginFieldSchema,
  habitat_instance_id: habitatInstanceIdSchema,
  public_key: z.string().min(1),
});

export const federationRoleSchema = z.enum(["disabled", "hub", "satellite"]);

export const federationConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    role: federationRoleSchema.default("disabled"),
    hub: federationHubConfigSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.enabled || value.role === "disabled") return;
    if (value.role === "hub" && value.hub != null) {
      ctx.addIssue({
        code: "custom",
        message: "Hub 角色不可配置 federation.hub",
        path: ["hub"],
      });
    }
    if (value.role === "satellite") {
      if (value.hub == null) {
        ctx.addIssue({
          code: "custom",
          message: "Satellite 须填写 federation.hub（origin、habitat_instance_id、public_key）",
          path: ["hub"],
        });
      }
    }
  });

export type FederationConfig = z.infer<typeof federationConfigSchema>;
export type FederationHubConfig = z.infer<typeof federationHubConfigSchema>;
