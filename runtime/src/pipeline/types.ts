/** 单步执行状态 */
export type StepStatus = "pending" | "running" | "completed" | "skipped" | "failed";

/** Pipeline 整体运行状态 */
export type PipelineRunStatus = "running" | "completed" | "failed";

/** 步骤执行上下文（由调用方注入业务字段） */
export type PipelineContext = {
  day?: string;
  /** 跳过依赖检查，用于诊断单步运行 */
  force?: boolean;
  [key: string]: unknown;
};

/** 单步 handler 返回 */
export type PipelineStepResult = {
  ok: boolean;
  output?: unknown;
  error?: string;
  /** skip 原因（handler 主动跳过） */
  skipped?: string;
};

export type StepHandler = (ctx: PipelineContext) => Promise<PipelineStepResult>;

/** DAG 节点定义 */
export type PipelineNodeDefinition = {
  id: string;
  /** 注册到 Runner 的 handler key */
  handler: string;
  dependsOn?: string[];
  /** 运行前判定；为 true 则标记 skipped */
  skipIf?: (ctx: PipelineContext) => boolean | Promise<boolean>;
  /** 失败后是否仍继续下游（默认可选节点为 true） */
  optional?: boolean;
};

export type PipelineDefinition = {
  id: string;
  nodes: PipelineNodeDefinition[];
};

export type PipelineStepState = {
  status: StepStatus;
  started_at?: string;
  finished_at?: string;
  output?: unknown;
  error?: string;
  skipped_reason?: string;
};

export type PipelineRunState = {
  pipeline_id: string;
  run_id: string;
  day?: string;
  started_at: string;
  finished_at?: string;
  status: PipelineRunStatus;
  steps: Record<string, PipelineStepState>;
};

export type PipelineRunResult = {
  ok: boolean;
  pipeline_id: string;
  run_id: string;
  day?: string;
  status: PipelineRunStatus;
  steps: Record<string, PipelineStepState>;
};

export type RunStepResult = {
  ok: boolean;
  step_id: string;
  status: StepStatus;
  output?: unknown;
  error?: string;
  skipped_reason?: string;
  dependency_error?: string;
};
