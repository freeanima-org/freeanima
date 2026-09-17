import { z } from "zod";

export const cjkConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    dict_path: z.string().optional(),
  })
  .optional();

export type CjkConfigInput = z.infer<typeof cjkConfigSchema>;
