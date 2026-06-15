import { bigint, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const pipelineStepRun = pgTable(
  "pipeline_step_run",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    pipelineId: text("pipeline_id").notNull(),
    runId: text("run_id").notNull(),
    stepId: text("step_id").notNull(),
    attempt: integer("attempt").notNull(),
    day: text("day").notNull(),
    trigger: text("trigger").notNull(),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "string" }).notNull(),
    output: jsonb("output"),
    error: text("error"),
    skippedReason: text("skipped_reason"),
  },
  (t) => [
    index("idx_pipeline_step_run_pipeline_finished").on(t.pipelineId, t.finishedAt),
    index("idx_pipeline_step_run_run_step_attempt").on(t.runId, t.stepId, t.attempt),
    index("idx_pipeline_step_run_step_finished").on(t.stepId, t.finishedAt),
  ],
);
