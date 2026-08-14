import { DREAM_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { DREAM_COMPONENT };

import { z } from "zod";

/** Semantic tag on content_block（梦境叙事；parent = dated diary_entry） */

export const dreamEpisodicSnippetSchema = z.object({
  conversation_id: z.string(),
  message_id: z.string().optional(),
  role: z.string(),
  content: z.string(),
  timestamp: z.string().optional(),
});

export type DreamEpisodicSnippet = z.infer<typeof dreamEpisodicSnippetSchema>;

export const dreamBodySchema = z.object({
  source_limbic_ids: z.array(z.string()).default([]),
  source_conversation_ids: z.array(z.string()).default([]),
  episodic_snippets: z.array(dreamEpisodicSnippetSchema).default([]),
  /** 旧 dream_memory / dream_entry 追溯 */
  legacy_id: z.string().optional(),
});

export type DreamBody = z.infer<typeof dreamBodySchema>;
