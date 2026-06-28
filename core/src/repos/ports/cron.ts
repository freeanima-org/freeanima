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
  deliver?: string;
  timeout_sec?: number;
  builtin?: boolean;
  repeat?: number | null;
  run_count?: number;
  paused?: boolean;
  created_at?: Date;
  updated_at?: Date;
  last_run_at?: Date | null;
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
  last_run_at?: Date | null;
  last_output_ref?: string | null;
  updated_at?: Date;
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
