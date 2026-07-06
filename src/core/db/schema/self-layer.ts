import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";
import { z } from "zod";

export const selfBlockKeySchema = z.enum([
  "existence_anchor",
  "self_model",
  "personality_baseline",
  "direction",
  "metacognition",
  "autobiography_summary",
]);

export type SelfBlockKey = z.infer<typeof selfBlockKeySchema>;

/** Self-layer six blocks (one row per block_key) */
export const selfBlocks = pgTable("self_blocks", {
  block_key: text("block_key").primaryKey(),
  content: text("content").notNull().default(""),
  locked: boolean("locked").notNull().default(false),
  version: integer("version").notNull().default(1),
  updated_by: text("updated_by"),
  created_at: pgTimestamptz("created_at")
    .notNull()
    .default(sql`now()`),
  updated_at: pgTimestamptz("updated_at")
    .notNull()
    .default(sql`now()`),
});
