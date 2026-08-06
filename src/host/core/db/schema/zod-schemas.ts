import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { z } from "zod";

import {
  acpTasksSchema,
  awaitingClarifySchema,
  compressionJsonSchema,
  temporalDayJsonSchema,
  messagePayloadSchema,
  platformInfoSchema,
  conversationCachedToolsetsSchema,
  conversationFunctionsSchema,
  conversationGoalSchema,
  conversationStagedToolsetsSchema,
  conversationTodoStoreSchema,
} from "./jsonb/index.ts";
import { messages } from "./messages.ts";
import { semanticMemoryTypeSchema, semanticMemoryStatusSchema } from "./semantic-memory.ts";
import { selfBlockKeySchema, selfBlocks } from "./self-layer.ts";
import { conversations } from "./conversations.ts";

const conversationJsonbRefine = {
  platform_info: platformInfoSchema.nullable(),
  module: z.enum(["chat", "coding"]).nullable().optional(),
  compression: compressionJsonSchema.nullable(),
  temporal_day: temporalDayJsonSchema.nullable(),
  todos: conversationTodoStoreSchema,
  awaiting_clarify: awaitingClarifySchema.nullable(),
  acp_tasks: acpTasksSchema.nullable(),
  goal: conversationGoalSchema.nullable(),
  cached_toolsets: conversationCachedToolsetsSchema,
  staged_toolsets: conversationStagedToolsetsSchema,
  functions: conversationFunctionsSchema,
  system_prompt_built_at: z.coerce.date().nullable().optional(),
  archived_at: z.coerce.date().nullable().optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
};

export const conversationSelectSchema = createSelectSchema(conversations, conversationJsonbRefine);
export const conversationInsertSchema = createInsertSchema(conversations, conversationJsonbRefine);

const messageJsonbRefine = {
  payload: messagePayloadSchema,
};

export const messageSelectSchema = createSelectSchema(messages, messageJsonbRefine);
export const messageInsertSchema = createInsertSchema(messages, messageJsonbRefine);

export type ConversationSelect = z.infer<typeof conversationSelectSchema>;
export type ConversationInsert = z.infer<typeof conversationInsertSchema>;
export type MessageSelect = z.infer<typeof messageSelectSchema>;
export type MessageInsert = z.infer<typeof messageInsertSchema>;

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

const selfBlocksRefine = {
  block_key: selfBlockKeySchema,
};

export const selfBlocksSelectSchema = createSelectSchema(selfBlocks, selfBlocksRefine);
export const selfBlocksInsertSchema = createInsertSchema(selfBlocks, selfBlocksRefine);

export type SelfBlocksSelect = z.infer<typeof selfBlocksSelectSchema>;
export type SelfBlocksInsert = z.infer<typeof selfBlocksInsertSchema>;
