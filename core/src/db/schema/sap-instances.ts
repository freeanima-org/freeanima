import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Hub-assigned SAP satellite instance ids (3-char, globally unique) */
export const sapInstances = pgTable("sap_instances", {
  instanceId: text("instance_id").primaryKey(),
  appId: text("app_id").notNull(),
  httpUrl: text("http_url"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});
