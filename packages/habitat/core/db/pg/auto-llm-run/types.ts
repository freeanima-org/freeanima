import type { MessagePayload } from "@freeanima/habitat/core/db/schema";

export type AutoLlmRunStatus = "running" | "ok" | "error";

export type AutoLlmRunRow = {
  id: string;
  run_name: string;
  run_kind: string;
  subject_id: number;
  output: string;
  status: string;
  duration_ms: number;
  max_loop_iterations: number;
  max_duration_ms: number | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  finished_at: string | null;
};

export type AutoLlmMessageRow = {
  id: string;
  run_id: string;
  subject_id: number;
  pos: number;
  payload: MessagePayload;
};

export type AutoLlmMessageAppendInput = {
  id?: string;
  subject_id: number;
  pos: number;
  payload: MessagePayload;
};

export type AutoLlmRunInsertRunningInput = {
  id: string;
  run_name: string;
  run_kind: string;
  subject_id: number;
  max_loop_iterations: number;
  max_duration_ms?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  messages?: AutoLlmMessageAppendInput[];
};

export type AutoLlmRunFinishInput = {
  id: string;
  status: "ok" | "error";
  output: string;
  duration_ms: number;
  error?: string | null;
  finished_at?: string;
};

/** @deprecated 一次插完；新路径用 insertRunning + appendMessages + finish */
export type AutoLlmRunAppendInput = {
  id: string;
  run_name: string;
  run_kind: string;
  subject_id: number;
  output: string;
  status: "ok" | "error";
  duration_ms: number;
  max_loop_iterations: number;
  max_duration_ms?: number | null;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  finished_at?: string;
  messages?: AutoLlmMessageAppendInput[];
};

export type PurgeStaleAutoLlmRunsOpts = {
  olderThan: Date;
  perRunKindKeep?: number;
};

export type AutoLlmRunListOpts = {
  run_kind?: string;
  status?: AutoLlmRunStatus;
  limit?: number;
  offset?: number;
};

export type AutoLlmRunCountOpts = {
  run_kind?: string;
  status?: AutoLlmRunStatus;
};
