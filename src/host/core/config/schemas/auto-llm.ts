import { z } from "zod";

export const autoLlmConfigSchema = z
  .object({
    retention_days: z.number().int().positive().optional(),
    per_run_kind_keep: z.number().int().nonnegative().optional(),
    subagent: z
      .object({
        max_turns: z.number().int().positive().optional(),
        max_parallel: z.number().int().positive().optional(),
      })
      .optional(),
  })
  .optional();

export type AutoLlmConfigInput = z.infer<typeof autoLlmConfigSchema>;
