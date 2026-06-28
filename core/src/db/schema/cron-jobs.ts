import { boolean, index, integer, pgTable, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";

export const cronJobs = pgTable(
  "cron_jobs",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    schedule: text("schedule").notNull(),
    prompt: text("prompt").notNull().default(""),
    skills: text("skills").array().notNull().default([]),
    script: text("script"),
    no_agent: boolean("no_agent").notNull().default(false),
    model_provider: text("model_provider"),
    model_name: text("model_name"),
    workdir: text("workdir"),
    context_from: text("context_from").array().notNull().default([]),
    deliver: text("deliver").notNull().default("local"),
    timeout_sec: integer("timeout_sec").notNull().default(300),
    builtin: boolean("builtin").notNull().default(false),
    repeat: integer("repeat"),
    run_count: integer("run_count").notNull().default(0),
    paused: boolean("paused").notNull().default(false),
    created_at: pgTimestamptz("created_at")
      .notNull()
      .default(sql`now()`),
    updated_at: pgTimestamptz("updated_at")
      .notNull()
      .default(sql`now()`),
    last_run_at: pgTimestamptz("last_run_at"),
    last_output_ref: text("last_output_ref"),
  },
  (t) => [index("idx_cron_jobs_paused").on(t.paused)],
);
