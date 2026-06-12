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

export async function startSleepBackfill(body?: { from?: string; to?: string; resume?: boolean }) {
  const result = await webuiCtx().startLightSleepBackfill({
    fromDay: body?.from,
    toDay: body?.to,
    resume: body?.resume,
  });
  if (!result.ok) {
    throw new ApiHandlerError(503, result.error, { code: "sleep_backfill_busy" });
  }
  return result;
}

export function getSleepBackfillStatus() {
  return webuiCtx().getLightSleepBackfillStatus();
}
