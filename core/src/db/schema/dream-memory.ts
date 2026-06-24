import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod";

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
    dreamDay: text("dream_day").notNull(),
    content: text("content").notNull(),
    sourceLimbicIds: text("source_limbic_ids").array().notNull().default([]),
    sourceConversationIds: text("source_conversation_ids").array().notNull().default([]),
    episodicSnippets: jsonb("episodic_snippets")
      .$type<DreamEpisodicSnippet[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_dream_memory_dream_day").on(t.dreamDay),
    index("idx_dream_memory_created_at").on(t.createdAt.desc()),
  ],
);
