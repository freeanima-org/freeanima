/** PG cron_jobs row (consumed by platform/connectors/cron / API) */
export type CronJobRow = {
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
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  last_output_ref: string | null;
};

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
  deliver?: string;
  timeout_sec?: number;
  builtin?: boolean;
  repeat?: number | null;
  run_count?: number;
  paused?: boolean;
  created_at?: string;
  updated_at?: string;
  last_run_at?: string | null;
  last_output_ref?: string | null;
};

/** Built-in job upsert: update name/schedule only; do not overwrite runtime fields */
export type CronJobBuiltinUpsertInput = {
  id: string;
  name: string;
  schedule: string;
  prompt?: string;
  no_agent?: boolean;
  deliver?: string;
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
  deliver?: string;
  timeout_sec?: number;
  repeat?: number | null;
  run_count?: number;
  paused?: boolean;
  last_run_at?: string | null;
  last_output_ref?: string | null;
  updated_at?: string;
};

/** Cron job persistence port */
export interface CronJobStorePort {
  create(row: CronJobCreateInput): Promise<void>;
  upsertBuiltin(row: CronJobBuiltinUpsertInput): Promise<boolean>;
  get(id: string): Promise<CronJobRow | null>;
  update(row: CronJobUpdateInput): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  listAll(): Promise<CronJobRow[]>;
}
