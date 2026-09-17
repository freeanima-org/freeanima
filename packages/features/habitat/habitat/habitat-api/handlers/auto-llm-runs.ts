import { habitatCtx } from "./runtime.ts";

export async function listAutoLlmRuns(opts?: {
  run_kind?: string;
  status?: "running" | "ok" | "error";
  limit?: number;
  offset?: number;
}) {
  return habitatCtx().listAutoLlmRuns(opts);
}

export async function getAutoLlmRun(opts: { id: string }) {
  return habitatCtx().getAutoLlmRun(opts.id);
}
