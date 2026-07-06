import { z } from "zod";

export const DREAM_ENTRY_COMPONENT = "dream_entry" as const;

export const dreamEpisodicSnippetSchema = z.object({
  conversation_id: z.string(),
  message_id: z.string().optional(),
  role: z.string(),
  content: z.string(),
  timestamp: z.string().optional(),
});

export type DreamEpisodicSnippet = z.infer<typeof dreamEpisodicSnippetSchema>;

export const dreamEntryBodySchema = z.object({
  dream_day: z.string().min(1),
  source_limbic_ids: z.array(z.string()).default([]),
  source_conversation_ids: z.array(z.string()).default([]),
  episodic_snippets: z.array(dreamEpisodicSnippetSchema).default([]),
  legacy_id: z.string().optional(),
});

export type DreamEntryBody = z.infer<typeof dreamEntryBodySchema>;
