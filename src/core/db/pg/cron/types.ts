import type { CronJobRow } from "@freeanima/core/db/schema/rows";

export type { CronJobRow };

export type CronJobCreateInput = {
  id: string;
  name: string;
  schedule: string;
  prompt?: string;
  skills?: string[];
  script?: string | null;
  no_agent?: boolean;
  model_provider?: string | null;
  model_name?: string | null;
  workdir?: string | null;
  context_from?: string[];
  timeout_sec?: number;
  builtin?: boolean;
  repeat?: number | null;
  run_count?: number;
  paused?: boolean;
  created_at?: Date;
  updated_at?: Date;
  last_run_at?: Date | null;
  last_output_ref?: string | null;
  notify_on_success?: boolean;
};

/** Built-in job upsert: update name/schedule/builtin/no_agent/timeout；不覆盖 run_count 等运行时字段 */
export type CronJobBuiltinUpsertInput = {
  id: string;
  name: string;
  schedule: string;
  prompt?: string;
  no_agent?: boolean;
  timeout_sec?: number;
};

/** Overlay update: only passed fields change */
export type CronJobUpdateInput = {
  id: string;
  name?: string;
  schedule?: string;
  prompt?: string;
  skills?: string[];
  script?: string | null;
  no_agent?: boolean;
  model_provider?: string | null;
  model_name?: string | null;
  workdir?: string | null;
  context_from?: string[];
  timeout_sec?: number;
  repeat?: number | null;
  run_count?: number;
  paused?: boolean;
  last_run_at?: Date | null;
  last_output_ref?: string | null;
  notify_on_success?: boolean;
  updated_at?: Date;
};

/** PG cron_log row */
export type CronLogRow = {
  id: number;
  job_id: string;
  run_count: number;
  ok: boolean;
  finished_at: string;
  output: Record<string, unknown> | null;
  output_text: string | null;
  error: string | null;
};

export type CronLogAppendInput = {
  job_id: string;
  run_count: number;
  ok: boolean;
  finished_at?: string;
  output?: Record<string, unknown> | null;
  output_text?: string | null;
  error?: string | null;
};

export type CronLogListOpts = {
  job_id?: string;
  job_ids?: string[];
  ok?: boolean;
  limit?: number;
  offset?: number;
};
