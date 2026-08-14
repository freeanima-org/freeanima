import { z } from "zod";

const modelEntrySchema = z.object({
  context_window: z.number().int().positive().optional(),
});

export const modelsConfigSchema = z.record(z.string(), modelEntrySchema);
