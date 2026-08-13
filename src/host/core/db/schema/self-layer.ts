import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";
export { selfBlockKeySchema, type SelfBlockKey } from "@freeanima/shared/pg-shapes/entity/enums.ts";

/** Self-layer five blocks (one row per block_key) */
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
