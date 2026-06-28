import { z } from "zod";

export const semanticMemoryRowSchema = z.object({
  id: z.string(),
  type: z.string(),
  pinned: z.boolean(),
  content: z.string(),
  source_conversations: z.array(z.string()),
  observed_at: z.string().nullable(),
  occurred_at: z.string().nullable(),
  status: z.string(),
  reference_count: z.number(),
  created: z.string(),
  updated: z.string(),
});

export type SemanticMemoryRow = z.infer<typeof semanticMemoryRowSchema>;

export const semanticFtsHitSchema = semanticMemoryRowSchema.extend({
  rank: z.number(),
});

export type SemanticFtsHit = z.infer<typeof semanticFtsHitSchema>;
