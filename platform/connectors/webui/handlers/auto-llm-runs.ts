import { webuiCtx } from "./runtime.ts";

export async function listAutoLlmRuns(opts?: {
  run_kind?: string;
  status?: "ok" | "error";
  limit?: number;
  offset?: number;
}) {
  return webuiCtx().listAutoLlmRuns(opts);
}
