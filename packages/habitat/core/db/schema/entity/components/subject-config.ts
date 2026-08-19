import { z } from "zod";

/** agent_config / user_config 共有 body 字段 */
export const subjectConfigBodySchema = z.object({
  default_private_world_id: z.number().int().positive().optional(),
  /** 稳定公开 id（nanoid）；≠ entities.id */
  public_id: z.string().min(1).optional(),
  /** Ed25519 公钥（base64url）；私钥在 habitat_runtime_config.identity.subject_keys */
  public_key: z.string().min(1).optional(),
});

export type SubjectConfigBody = z.infer<typeof subjectConfigBodySchema>;
