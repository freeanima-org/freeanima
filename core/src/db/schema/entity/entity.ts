import { bigint, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

export const entityTypeSchema = z.enum(["content", "world", "agent", "user"]);
export type EntityType = z.infer<typeof entityTypeSchema>;

export const entities = pgTable(
  "entities",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    type: text("type").notNull(),
    worldId: bigint("world_id", { mode: "number" }).notNull(),
    ownerId: bigint("owner_id", { mode: "number" }),
    components: text("components").array().notNull().default([]),
    primaryComponent: text("primary_component").notNull(),
    title: text("title").notNull().default(""),
    summary: text("summary").notNull().default(""),
    content: text("content").notNull().default(""),
    body: jsonb("body").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_entities_world_id").on(t.worldId),
    index("idx_entities_owner_id").on(t.ownerId),
    index("idx_entities_primary_component").on(t.primaryComponent),
    index("idx_entities_components").using("gin", t.components),
  ],
);

export type EntityInsert = typeof entities.$inferInsert;
export type EntitySelect = typeof entities.$inferSelect;
