import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const autoLlmRuns = pgTable(
  "auto_llm_runs",
  {
    id: text("id").primaryKey(),
    run_name: text("run_name").notNull(),
    run_kind: text("run_kind").notNull(),
    input_summary: text("input_summary").notNull().default(""),
    output: text("output").notNull().default(""),
    status: text("status").notNull(),
    duration_ms: integer("duration_ms").notNull(),
    error: text("error"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    finished_at: timestamp("finished_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (t) => [
    index("idx_auto_llm_runs_kind_finished").on(t.run_kind, t.finished_at),
    index("idx_auto_llm_runs_name_finished").on(t.run_name, t.finished_at),
  ],
);
