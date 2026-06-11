import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const cronLog = pgTable(
  "cron_log",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    jobId: text("job_id").notNull(),
    runCount: integer("run_count").notNull(),
    ok: boolean("ok").notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    output: jsonb("output"),
    outputText: text("output_text"),
    error: text("error"),
  },
  (t) => [
    unique("cron_log_job_id_run_count_unique").on(t.jobId, t.runCount),
    index("idx_cron_log_job_finished").on(t.jobId, t.finishedAt),
  ],
);
