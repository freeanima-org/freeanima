import type { CronJobRow } from "@freeanima/core/repos";
import { normalizePgTimestamp } from "@freeanima/core/db/schema";

export type CronJobDbRow = {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  skills: string[];
  script: string | null;
  no_agent: boolean;
  model_provider: string | null;
  model_name: string | null;
  workdir: string | null;
  context_from: string[];
  deliver: string;
  timeout_sec: number;
  builtin: boolean;
  repeat: number | null;
  run_count: number;
  paused: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  last_run_at: Date | string | null;
  last_output_ref: string | null;
};

export function mapCronJobRow(row: CronJobDbRow): CronJobRow {
  return {
    id: row.id,
    name: row.name,
    schedule: row.schedule,
    prompt: row.prompt,
    skills: row.skills ?? [],
    script: row.script,
    no_agent: row.no_agent,
    model_provider: row.model_provider,
    model_name: row.model_name,
    workdir: row.workdir,
    context_from: row.context_from ?? [],
    deliver: row.deliver,
    timeout_sec: row.timeout_sec,
    builtin: row.builtin,
    repeat: row.repeat,
    run_count: row.run_count,
    paused: row.paused,
    created_at: normalizePgTimestamp(row.created_at),
    updated_at: normalizePgTimestamp(row.updated_at),
    last_run_at: row.last_run_at != null ? normalizePgTimestamp(row.last_run_at) : null,
    last_output_ref: row.last_output_ref,
  };
}
