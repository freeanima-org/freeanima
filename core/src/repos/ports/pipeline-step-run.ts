/** 流水线节点单次执行记录 */
export type PipelineStepRunRow = {
  id: number;
  pipeline_id: string;
  run_id: string;
  step_id: string;
  attempt: number;
  day: string;
  trigger: string;
  status: string;
  started_at: string | null;
  finished_at: string;
  output: Record<string, unknown> | null;
  error: string | null;
  skipped_reason: string | null;
};

export type PipelineStepRunAppendInput = {
  pipeline_id: string;
  run_id: string;
  step_id: string;
  day: string;
  trigger: string;
  status: string;
  started_at?: string | null;
  finished_at?: string;
  output?: Record<string, unknown> | null;
  error?: string | null;
  skipped_reason?: string | null;
};

export type PipelineStepRunListOpts = {
  pipeline_id?: string;
  run_id?: string;
  step_id?: string;
  limit?: number;
  offset?: number;
};

export interface PipelineStepRunStorePort {
  append(row: PipelineStepRunAppendInput): Promise<void>;
  list(opts?: PipelineStepRunListOpts): Promise<PipelineStepRunRow[]>;
}
