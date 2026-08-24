import type {
  WorkflowBody,
  WorkflowStep,
  JsonValue,
} from "@freeanima/habitat/core/db/schema/entity/components/workflow.ts";

export type WorkflowRow = {
  id: number;
  world_id: number;
  name: string;
  title: string;
  summary: string;
  content: string;
  steps: WorkflowStep[];
  input_schema?: WorkflowBody["input_schema"];
  output_schema?: WorkflowBody["output_schema"];
  origin: WorkflowBody["origin"];
  status: WorkflowBody["status"];
  allowed_tools: string[];
  denied_tools: string[];
  pure?: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkflowCreateInput = {
  name: string;
  summary?: string;
  content?: string;
  steps: WorkflowStep[];
  input_schema?: WorkflowBody["input_schema"];
  output_schema?: WorkflowBody["output_schema"];
  origin?: WorkflowBody["origin"];
  status?: WorkflowBody["status"];
  allowed_tools?: string[];
  denied_tools?: string[];
  pure?: boolean;
};

export type WorkflowUpdateInput = {
  id: number;
  name?: string;
  summary?: string;
  content?: string;
  steps?: WorkflowStep[];
  input_schema?: WorkflowBody["input_schema"] | null;
  output_schema?: WorkflowBody["output_schema"] | null;
  origin?: WorkflowBody["origin"];
  status?: WorkflowBody["status"];
  allowed_tools?: string[];
  denied_tools?: string[];
  pure?: boolean | null;
};

export type WorkflowVarRoot = {
  input: JsonValue;
  prev: JsonValue | undefined;
  step: Record<string, { output: JsonValue }>;
  last_run: { id: string; output: JsonValue } | null;
};

export type WorkflowStepDebug = {
  id: string;
  type: string;
  output: JsonValue;
  error?: string;
};

export type WorkflowRunResult = {
  run_id: string;
  output: JsonValue;
  status: "completed" | "failed";
  error?: string;
  steps?: WorkflowStepDebug[];
};

export type WorkflowValidateIssue = {
  step_id?: string;
  field?: string;
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type WorkflowValidateResult = {
  ok: boolean;
  errors: WorkflowValidateIssue[];
  warnings: WorkflowValidateIssue[];
};
