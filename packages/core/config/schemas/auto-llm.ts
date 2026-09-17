import { z } from "zod";

export const autoLlmConfigSchema = z
  .object({
    retention_days: z.number().int().positive().optional(),
    per_run_kind_keep: z.number().int().nonnegative().optional(),
    subagent: z
      .object({
        max_loop_iterations: z.number().int().positive().optional(),
        max_parallel: z.number().int().positive().optional(),
        /** 子代理采样档位兜底；未设则 balanced */
        temperature_tier: z.enum(["focused", "balanced", "creative"]).optional(),
      })
      .optional(),
  })
  .optional();

export type AutoLlmConfigInput = z.infer<typeof autoLlmConfigSchema>;
