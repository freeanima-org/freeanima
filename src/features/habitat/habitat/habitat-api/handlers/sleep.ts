import { omitUndefined } from "@freeanima/host/core/util";
import { habitatCtx } from "./runtime.ts";
import { ApiHandlerError } from "./errors.ts";

export async function getSleepSummary() {
  return habitatCtx().getSleepSummary();
}

export async function listPipelineStepRuns(opts?: {
  step_id?: string;
  run_id?: string;
  limit?: number;
  offset?: number;
}) {
  return habitatCtx().listPipelineStepRuns(opts);
}

export async function listCronLogs(opts?: {
  job_id?: string;
  limit?: number;
  offset?: number;
  ok?: boolean;
}) {
  return habitatCtx().listCronLogs(opts);
}

export function getSleepPipelineStatus() {
  return habitatCtx().getSleepPipelineStatus();
}

export async function startSleepCycle(body?: {
  day?: string;
  deep_sleep_mode?: "full" | "incremental";
}) {
  const result = await habitatCtx().startSleepCycle(
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
  const result = await habitatCtx().startSleepPipelineStep(
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

export async function startSleepCatchUp() {
  const result = await habitatCtx().startSleepCatchUp();
  if (!result.ok) {
    throw new ApiHandlerError(400, result.error, { code: "sleep_catch_up_failed" });
  }
  return result;
}
