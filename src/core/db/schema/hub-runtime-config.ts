import { jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";

export const HUB_RUNTIME_CONFIG_ID = "default";

/** Hub 运行时配置（bootstrap 段仍在 config.yaml） */
export const hubRuntimeConfig = pgTable("hub_runtime_config", {
  id: text("id").primaryKey(),
  document: jsonb("document").$type<Record<string, unknown>>().notNull().default({}),
  updated_at: pgTimestamptz("updated_at")
    .notNull()
    .default(sql`now()`),
});
