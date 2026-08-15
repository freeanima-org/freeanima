import { index, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";

export const autoLlmRuns = pgTable(
  "auto_llm_runs",
  {
    id: text("id").primaryKey(),
    run_name: text("run_name").notNull(),
    run_kind: text("run_kind").notNull(),
    /** Acting subject (agent / future anima); null for legacy rows */
    subject_id: integer("subject_id"),
    output: text("output").notNull().default(""),
    status: text("status").notNull(),
    duration_ms: integer("duration_ms").notNull(),
    /** 轮数预算（引擎 maxTurns） */
    max_turns: integer("max_turns").notNull().default(50),
    /** 墙钟上限 ms；null = 未设超时 */
    max_duration_ms: integer("max_duration_ms"),
    error: text("error"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    created_at: pgTimestamptz("created_at").notNull(),
    finished_at: pgTimestamptz("finished_at").notNull(),
  },
  (t) => [
    index("idx_auto_llm_runs_kind_finished").on(t.run_kind, t.finished_at),
    index("idx_auto_llm_runs_name_finished").on(t.run_name, t.finished_at),
    index("idx_auto_llm_runs_subject_finished").on(t.subject_id, t.finished_at),
  ],
);
