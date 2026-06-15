import type { CronJobRow } from "@freeanima/core/repos";
import { cronJobs, normalizePgTimestamp } from "@freeanima/core/db/schema";

export type CronJobDbRow = typeof cronJobs.$inferSelect;

export function mapCronJobRow(row: CronJobDbRow): CronJobRow {
  return {
    id: row.id,
    name: row.name,
    schedule: row.schedule,
    prompt: row.prompt,
    skills: row.skills ?? [],
    script: row.script,
    no_agent: row.noAgent,
    model_provider: row.modelProvider,
    model_name: row.modelName,
    workdir: row.workdir,
    context_from: row.contextFrom ?? [],
    deliver: row.deliver,
    timeout_sec: row.timeoutSec,
    builtin: row.builtin,
    repeat: row.repeat,
    run_count: row.runCount,
    paused: row.paused,
    created_at: normalizePgTimestamp(row.createdAt),
    updated_at: normalizePgTimestamp(row.updatedAt),
    last_run_at: row.lastRunAt != null ? normalizePgTimestamp(row.lastRunAt) : null,
    last_output_ref: row.lastOutputRef,
  };
}
