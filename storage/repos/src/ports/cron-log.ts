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

export interface CronLogStorePort {
  append(row: CronLogAppendInput): Promise<void>;
  list(opts?: CronLogListOpts): Promise<CronLogRow[]>;
}
