import { z } from "zod";

/** 未配置 worlds 段时的默认 user subject entity id */
export const DEFAULT_USER_SUBJECT_ID = 1;

/** 未配置 worlds 段时的默认 agent subject entity id */
export const DEFAULT_AGENT_SUBJECT_ID = 2;

export const worldsConfigSchema = z
  .object({
    user_subject_id: z.number().int().positive().optional(),
    agent_subject_id: z.number().int().positive().optional(),
  })
  .optional();

export type WorldsConfigInput = z.infer<typeof worldsConfigSchema>;
