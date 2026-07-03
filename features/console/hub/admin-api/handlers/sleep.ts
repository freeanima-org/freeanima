import { omitUndefined } from "@freeanima/core/util";
import { adminCtx } from "./runtime.ts";
import { ApiHandlerError } from "./errors.ts";

export async function getSleepSummary() {
  return adminCtx().getSleepSummary();
}

export async function listPipelineStepRuns(opts?: {
  step_id?: string;
  run_id?: string;
  limit?: number;
  offset?: number;
}) {
  return adminCtx().listPipelineStepRuns(opts);
}

export async function listCronLogs(opts?: {
  job_id?: string;
  limit?: number;
  offset?: number;
  ok?: boolean;
}) {
  return adminCtx().listCronLogs(opts);
}

export function getDeepSleepRounds(day: string) {
  return adminCtx().getDeepSleepRounds(day);
}

export function getSleepPipelineStatus() {
  return adminCtx().getSleepPipelineStatus();
}

export async function startSleepCycle(body?: {
  day?: string;
  deep_sleep_mode?: "full" | "incremental";
}) {
  const result = await adminCtx().startSleepCycle(
    omitUndefined({
      day: body?.day,
      deep_sleep_mode: body?.deep_sleep_mode,
    }),
  );
  if (!result.ok) {
    throw new ApiHandlerError(503, result.error, { code: "sleep_cycle_busy" });
  }
  return result;
}

export async function startSleepPipelineStep(body: {
  step_id: string;
  day?: string;
  force?: boolean;
  deep_sleep_mode?: "full" | "incremental";
}) {
  const result = await adminCtx().startSleepPipelineStep(
    omitUndefined({
      stepId: body.step_id,
      day: body.day,
      force: body.force,
      deep_sleep_mode: body.deep_sleep_mode,
    }),
  );
  if (!result.ok) {
    throw new ApiHandlerError(400, result.error, { code: "sleep_step_failed" });
  }
  return result;
}
