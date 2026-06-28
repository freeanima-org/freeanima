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
    job_id: text("job_id").notNull(),
    run_count: integer("run_count").notNull(),
    ok: boolean("ok").notNull(),
    finished_at: timestamp("finished_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    output: jsonb("output"),
    output_text: text("output_text"),
    error: text("error"),
  },
  (t) => [
    unique("cron_log_job_id_run_count_unique").on(t.job_id, t.run_count),
    index("idx_cron_log_job_finished").on(t.job_id, t.finished_at),
  ],
);
