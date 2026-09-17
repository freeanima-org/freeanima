import { z } from "zod";

import { HABITAT_INSTANCE_ID_PREFIX } from "@freeanima/shared/identity";

export const identityKeyPairSchema = z.object({
  public_key: z.string().min(1),
  private_key: z.string().min(1),
});

export const identityConfigSchema = z.object({
  /** `fa_inst_` + nanoid；首次启动生成后只读 */
  habitat_instance_id: z
    .string()
    .min(HABITAT_INSTANCE_ID_PREFIX.length + 1)
    .refine((v) => v.startsWith(HABITAT_INSTANCE_ID_PREFIX), {
      message: `habitat_instance_id must start with ${HABITAT_INSTANCE_ID_PREFIX}`,
    }),
  public_key: z.string().min(1),
  private_key: z.string().min(1),
  /** subject.public_id → 密钥对；私钥不进 entity body */
  subject_keys: z.record(z.string(), identityKeyPairSchema).default({}),
});

export type IdentityConfig = z.infer<typeof identityConfigSchema>;
export type IdentityKeyPair = z.infer<typeof identityKeyPairSchema>;
