import { z } from "zod";

/** agent_config / user_config 共有 body 字段 */
export const subjectConfigBodySchema = z.object({
  default_private_world_id: z.number().int().positive().optional(),
});

export type SubjectConfigBody = z.infer<typeof subjectConfigBodySchema>;
