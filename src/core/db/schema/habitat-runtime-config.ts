import { jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";

export const HABITAT_RUNTIME_CONFIG_ID = "default";
/** @deprecated 0.9.3 后删除 — 请用 HABITAT_RUNTIME_CONFIG_ID */
export const HUB_RUNTIME_CONFIG_ID = HABITAT_RUNTIME_CONFIG_ID;

/** Habitat 运行时配置（bootstrap 段仍在 config.yaml） */
export const habitatRuntimeConfig = pgTable("habitat_runtime_config", {
  id: text("id").primaryKey(),
  document: jsonb("document").$type<Record<string, unknown>>().notNull().default({}),
  updated_at: pgTimestamptz("updated_at")
    .notNull()
    .default(sql`now()`),
});

/** @deprecated 0.9.3 后删除 — 请用 habitatRuntimeConfig */
export const hubRuntimeConfig = habitatRuntimeConfig;
