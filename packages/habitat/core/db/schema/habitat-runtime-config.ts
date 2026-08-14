import { jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";

/** Habitat 运行时配置：一行一段（bootstrap 段仍在 config.yaml） */
export const habitatRuntimeConfig = pgTable("habitat_runtime_config", {
  section: text("section").primaryKey(),
  /** 段内容：多为 object；少数段可为 array（如 fallback_providers） */
  value: jsonb("value").$type<unknown>().notNull().default({}),
  updated_at: pgTimestamptz("updated_at")
    .notNull()
    .default(sql`now()`),
});
