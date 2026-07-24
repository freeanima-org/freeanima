export type AutoLlmRunRow = {
  id: string;
  run_name: string;
  run_kind: string;
  input_summary: string;
  output: string;
  status: string;
  duration_ms: number;
  error: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  finished_at: string;
};

export type AutoLlmRunAppendInput = {
  id: string;
  run_name: string;
  run_kind: string;
  input_summary: string;
  output: string;
  status: "ok" | "error";
  duration_ms: number;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  finished_at?: string;
};

export type PurgeStaleAutoLlmRunsOpts = {
  olderThan: Date;
  perRunKindKeep?: number;
};

export type AutoLlmRunListOpts = {
  run_kind?: string;
  status?: "ok" | "error";
  limit?: number;
  offset?: number;
};

export type AutoLlmRunCountOpts = {
  run_kind?: string;
  status?: "ok" | "error";
};
