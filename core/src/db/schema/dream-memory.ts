import { index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { z } from "zod";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";

export const dreamEpisodicSnippetSchema = z.object({
  conversation_id: z.string(),
  message_id: z.string().optional(),
  role: z.string(),
  content: z.string(),
  timestamp: z.string().optional(),
});

export type DreamEpisodicSnippet = z.infer<typeof dreamEpisodicSnippetSchema>;

/** Dream memory (creative nightly narrative; append-only per calendar day) */
export const dreamMemory = pgTable(
  "dream_memory",
  {
    id: text("id").primaryKey(),
    dream_day: text("dream_day").notNull(),
    content: text("content").notNull(),
    source_limbic_ids: text("source_limbic_ids").array().notNull().default([]),
    source_conversation_ids: text("source_conversation_ids").array().notNull().default([]),
    episodic_snippets: jsonb("episodic_snippets")
      .$type<DreamEpisodicSnippet[]>()
      .notNull()
      .default([]),
    created_at: pgTimestamptz("created_at")
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("idx_dream_memory_dream_day").on(t.dream_day),
    index("idx_dream_memory_created_at").on(t.created_at.desc()),
  ],
);
