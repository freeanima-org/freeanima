import { bigint, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const pipelineStepRun = pgTable(
  "pipeline_step_run",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    pipeline_id: text("pipeline_id").notNull(),
    run_id: text("run_id").notNull(),
    step_id: text("step_id").notNull(),
    attempt: integer("attempt").notNull(),
    day: text("day").notNull(),
    trigger: text("trigger").notNull(),
    status: text("status").notNull(),
    started_at: timestamp("started_at", { withTimezone: true, mode: "string" }),
    finished_at: timestamp("finished_at", { withTimezone: true, mode: "string" }).notNull(),
    output: jsonb("output"),
    error: text("error"),
    skipped_reason: text("skipped_reason"),
  },
  (t) => [
    index("idx_pipeline_step_run_pipeline_finished").on(t.pipeline_id, t.finished_at),
    index("idx_pipeline_step_run_run_step_attempt").on(t.run_id, t.step_id, t.attempt),
    index("idx_pipeline_step_run_step_finished").on(t.step_id, t.finished_at),
  ],
);
