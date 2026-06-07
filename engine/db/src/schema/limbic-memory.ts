import { index, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";

export const limbicKindSchema = z.enum(["session_mood", "turning_point", "spike"]);

export type LimbicKind = z.infer<typeof limbicKindSchema>;

/** 边缘系统记忆（情感/强度；不注入 system prompt） */
export const limbicMemory = pgTable(
  "limbic_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: text("session_id").notNull(),
    kind: text("kind").notNull(),
    valence: real("valence"),
    arousal: real("arousal"),
    content: text("content").notNull(),
    intensity: real("intensity").notNull().default(0.5),
    sourceSegment: text("source_segment"),
    semanticMemoryIds: text("semantic_memory_ids").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_limbic_memory_semantic_memory_ids").using("gin", t.semanticMemoryIds),
    index("idx_limbic_memory_session_id").on(t.sessionId),
    index("idx_limbic_memory_created_at").on(t.createdAt),
    index("idx_limbic_memory_kind").on(t.kind),
    index("idx_limbic_memory_intensity").on(t.intensity),
    index("idx_limbic_memory_valence").on(t.valence),
    index("idx_limbic_memory_arousal").on(t.arousal),
  ],
);
