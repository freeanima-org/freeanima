import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Hub-assigned SAP satellite instance ids (3-char, globally unique) */
export const sapInstances = pgTable("sap_instances", {
  instance_id: text("instance_id").primaryKey(),
  app_id: text("app_id").notNull(),
  http_url: text("http_url"),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});
