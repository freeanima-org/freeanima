import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const autoLlmRuns = pgTable(
  "auto_llm_runs",
  {
    id: text("id").primaryKey(),
    runName: text("run_name").notNull(),
    runKind: text("run_kind").notNull(),
    inputSummary: text("input_summary").notNull().default(""),
    output: text("output").notNull().default(""),
    status: text("status").notNull(),
    durationMs: integer("duration_ms").notNull(),
    error: text("error"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (t) => [
    index("idx_auto_llm_runs_kind_finished").on(t.runKind, t.finishedAt),
    index("idx_auto_llm_runs_name_finished").on(t.runName, t.finishedAt),
  ],
);
