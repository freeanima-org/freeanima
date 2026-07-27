import { z } from "zod";

export const ftsTrgmConfigSchema = z
  .object({
    min_similarity: z.number().min(0).max(1).optional(),
    fallback_when_hits_lt: z.number().int().nonnegative().optional(),
  })
  .optional();

export const ftsConfigSchema = z
  .object({
    trgm: ftsTrgmConfigSchema,
  })
  .optional();

export type FtsConfigInput = z.infer<typeof ftsConfigSchema>;
