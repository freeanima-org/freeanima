import { z } from "zod";

export {
  conversationSelectSchema,
  conversationInsertSchema,
  type ConversationSelect,
  type ConversationInsert,
  messageSelectSchema,
  messageInsertSchema,
  type MessageSelect,
  type MessageInsert,
} from "@freeanima/shared/pg-shapes/rows/index.ts";

import {
  semanticMemoryTypeSchema,
  semanticMemoryStatusSchema,
} from "@freeanima/shared/pg-shapes/entity/semantic-memory.ts";

/** HTTP / tool validation for semantic memory entity rows. */
export const semanticMemorySelectSchema = z.object({
  id: z.number().int().positive(),
  type: semanticMemoryTypeSchema,
  pinned: z.boolean(),
  content: z.string(),
  source_conversations: z.array(z.string()),
  observed_at: z.coerce.date().nullable(),
  occurred_at: z.string().nullable(),
  status: semanticMemoryStatusSchema,
  reference_count: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  world_id: z.number().int().positive().optional(),
  legacy_id: z.string().optional(),
});
export const semanticMemoryInsertSchema = semanticMemorySelectSchema.partial().extend({
  content: z.string(),
  type: semanticMemoryTypeSchema.optional(),
});

export type SemanticMemorySelect = z.infer<typeof semanticMemorySelectSchema>;
export type SemanticMemoryInsert = z.infer<typeof semanticMemoryInsertSchema>;
