import { z } from "zod";

/** HTTP / tool validation for semantic memory rows (subset of table columns). */
export const semanticMemoryRowSchema = z.object({
  id: z.string(),
  type: z.string(),
  pinned: z.boolean(),
  content: z.string(),
  source_conversations: z.array(z.string()),
  observed_at: z.coerce.date().nullable(),
  occurred_at: z.string().nullable(),
  status: z.string(),
  reference_count: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type SemanticMemoryRowSchema = z.infer<typeof semanticMemoryRowSchema>;

export const semanticFtsHitSchema = semanticMemoryRowSchema.extend({
  rank: z.number(),
});

export type SemanticFtsHitSchema = z.infer<typeof semanticFtsHitSchema>;
