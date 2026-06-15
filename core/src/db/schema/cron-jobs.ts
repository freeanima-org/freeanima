import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const cronJobs = pgTable(
  "cron_jobs",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    schedule: text("schedule").notNull(),
    prompt: text("prompt").notNull().default(""),
    skills: text("skills").array().notNull().default([]),
    script: text("script"),
    noAgent: boolean("no_agent").notNull().default(false),
    modelProvider: text("model_provider"),
    modelName: text("model_name"),
    workdir: text("workdir"),
    contextFrom: text("context_from").array().notNull().default([]),
    deliver: text("deliver").notNull().default("local"),
    timeoutSec: integer("timeout_sec").notNull().default(300),
    builtin: boolean("builtin").notNull().default(false),
    repeat: integer("repeat"),
    runCount: integer("run_count").notNull().default(0),
    paused: boolean("paused").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true, mode: "string" }),
    lastOutputRef: text("last_output_ref"),
  },
  (t) => [index("idx_cron_jobs_paused").on(t.paused)],
);
