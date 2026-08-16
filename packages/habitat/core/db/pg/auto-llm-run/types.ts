import type { MessagePayload } from "@freeanima/habitat/core/db/schema";

export type AutoLlmRunRow = {
  id: string;
  run_name: string;
  run_kind: string;
  subject_id: number | null;
  output: string;
  status: string;
  duration_ms: number;
  max_loop_iterations: number;
  max_duration_ms: number | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  finished_at: string;
};

export type AutoLlmMessageRow = {
  id: string;
  run_id: string;
  pos: number;
  payload: MessagePayload;
};

export type AutoLlmMessageAppendInput = {
  id?: string;
  pos: number;
  payload: MessagePayload;
};

export type AutoLlmRunAppendInput = {
  id: string;
  run_name: string;
  run_kind: string;
  subject_id?: number | null;
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
  status?: "ok" | "error";
  limit?: number;
  offset?: number;
};

export type AutoLlmRunCountOpts = {
  run_kind?: string;
  status?: "ok" | "error";
};
