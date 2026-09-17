import { z } from "zod";

export const ftsTrgmConfigSchema = z
  .object({
    min_similarity: z.number().min(0).max(1).optional(),
    fallback_when_hits_lt: z.number().int().nonnegative().optional(),
  })
  .optional();

/** SearchBackend adapter id (runtime `fts.backend`). */
export const searchBackendIdSchema = z.enum(["pg_search_index", "pg_business_scan"]);

export const ftsConfigSchema = z
  .object({
    trgm: ftsTrgmConfigSchema,
    /** Default: pg_search_index (side-table). pg_business_scan = business-field baseline. */
    backend: searchBackendIdSchema.optional(),
  })
  .optional();

export type FtsConfigInput = z.infer<typeof ftsConfigSchema>;
export type SearchBackendId = z.infer<typeof searchBackendIdSchema>;
