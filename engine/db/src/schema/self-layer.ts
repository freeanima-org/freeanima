import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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

/** 自我层六块（每 block_key 一行） */
export const selfBlocks = pgTable("self_blocks", {
  blockKey: text("block_key").primaryKey(),
  content: text("content").notNull().default(""),
  locked: boolean("locked").notNull().default(false),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
