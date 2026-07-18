import { z } from "zod";

export const worldsConfigSchema = z
  .object({
    user_subject_id: z.number().int().positive().optional(),
    agent_subject_id: z.number().int().positive().optional(),
  })
  .optional();

export type WorldsConfigInput = z.infer<typeof worldsConfigSchema>;
