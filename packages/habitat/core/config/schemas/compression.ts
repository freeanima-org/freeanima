import { z } from "zod";

export const compressionSchema = z.object({
  enabled: z.boolean().optional(),
  max_rounds: z.number().int().positive().optional(),
  reserved_tokens: z.number().int().positive().optional(),
  trigger_high: z.number().min(0).max(1).optional(),
  trigger_low: z.number().min(0).max(1).optional(),
  emergency_ratio: z.number().min(0).max(1).optional(),
  raw_min_messages: z.number().int().positive().optional(),
  slim_min_messages: z.number().int().positive().optional(),
  summary_max_tokens: z.number().int().positive().optional(),
});
