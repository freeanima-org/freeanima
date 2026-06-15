import { webuiCtx } from "./runtime.ts";
import { ApiHandlerError } from "./errors.ts";

export async function getSleepSummary() {
  return webuiCtx().getSleepSummary();
}

export async function listSleepRuns(opts?: { limit?: number; offset?: number; ok?: boolean }) {
  return webuiCtx().listSleepRuns(opts);
}

export async function listCronLogs(opts?: {
  job_id?: string;
  limit?: number;
  offset?: number;
  ok?: boolean;
}) {
  return webuiCtx().listCronLogs(opts);
}

export function getDeepSleepRounds(day: string) {
  return webuiCtx().getDeepSleepRounds(day);
}

export function getSleepPipelineStatus() {
  return webuiCtx().getSleepPipelineStatus();
}

export async function startSleepCycle(body?: { day?: string }) {
  const result = await webuiCtx().startSleepCycle({ day: body?.day });
  if (!result.ok) {
    throw new ApiHandlerError(503, result.error, { code: "sleep_cycle_busy" });
  }
  return result;
}

export async function startSleepPipelineStep(body: {
  step_id: string;
  day?: string;
  force?: boolean;
}) {
  const result = await webuiCtx().startSleepPipelineStep({
    stepId: body.step_id,
    day: body.day,
    force: body.force,
  });
  if (!result.ok) {
    throw new ApiHandlerError(400, result.error, { code: "sleep_step_failed" });
  }
  return result;
}
