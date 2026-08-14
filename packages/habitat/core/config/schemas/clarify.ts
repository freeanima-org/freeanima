import { z } from "zod";

export const clarifySchema = z.object({
  timeout_sec: z.number().int().min(60).optional(),
  max_items: z.number().int().min(1).max(10).optional(),
});
