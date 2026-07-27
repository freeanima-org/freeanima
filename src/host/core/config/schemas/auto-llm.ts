import { z } from "zod";

export const autoLlmConfigSchema = z
  .object({
    retention_days: z.number().int().positive().optional(),
    per_run_kind_keep: z.number().int().nonnegative().optional(),
  })
  .optional();

export type AutoLlmConfigInput = z.infer<typeof autoLlmConfigSchema>;
