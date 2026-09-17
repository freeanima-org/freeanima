import { pgTable, text } from "drizzle-orm/pg-core";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";

/** Habitat-assigned Outpost instance ids (3-char, globally unique) */
export const outpostInstances = pgTable("outpost_instances", {
  instance_id: text("instance_id").primaryKey(),
  app_id: text("app_id").notNull(),
  http_url: text("http_url"),
  created_at: pgTimestamptz("created_at").notNull(),
});
