import { z } from "zod";

export const fallbackProviderSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  base_url: z.string().optional(),
});
