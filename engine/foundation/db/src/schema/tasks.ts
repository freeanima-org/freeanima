import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

import { sessions } from "./sessions.ts";

export const taskStatusSchema = z.enum(["pending", "in_progress", "completed", "cancelled"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskPrioritySchema = z.enum(["high", "medium", "low", "none"]);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("pending"),
    priority: text("priority").notNull().default("none"),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
    sourceSessionId: text("source_session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("idx_tasks_status").on(t.status),
    index("idx_tasks_list").on(t.status, t.priority, t.createdAt),
  ],
);
