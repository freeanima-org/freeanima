/** PG cron_jobs 行（connectors-cron / API 消费） */
export type CronJobRow = {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  skills: string[];
  script: string | null;
  no_agent: boolean;
  enabled_toolsets: string[] | null;
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
  enabled_toolsets?: string[] | null;
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

/** 内置任务 upsert：仅更新 name/schedule，不覆盖运行时字段 */
export type CronJobBuiltinUpsertInput = {
  id: string;
  name: string;
  schedule: string;
  prompt?: string;
  no_agent?: boolean;
  deliver?: string;
  timeout_sec?: number;
};

/** 覆盖式更新：仅传入的字段会被修改 */
export type CronJobUpdateInput = {
  id: string;
  name?: string;
  schedule?: string;
  prompt?: string;
  skills?: string[];
  script?: string | null;
  no_agent?: boolean;
  enabled_toolsets?: string[] | null;
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

/** 定时任务持久化端口 */
export interface CronJobStorePort {
  create(row: CronJobCreateInput): Promise<void>;
  upsertBuiltin(row: CronJobBuiltinUpsertInput): Promise<boolean>;
  get(id: string): Promise<CronJobRow | null>;
  update(row: CronJobUpdateInput): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  listAll(): Promise<CronJobRow[]>;
}
