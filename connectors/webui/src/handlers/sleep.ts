import { webuiCtx } from "./runtime.ts";
import { ApiHandlerError } from "./errors.ts";

export async function getSleepSummary() {
  const { service } = webuiCtx();
  return service.getSleepSummary();
}

export async function listSleepRuns(opts?: { limit?: number; offset?: number; ok?: boolean }) {
  const { service } = webuiCtx();
  return service.listSleepRuns(opts);
}

export async function listCronLogs(opts?: {
  job_id?: string;
  limit?: number;
  offset?: number;
  ok?: boolean;
}) {
  const { service } = webuiCtx();
  return service.listCronLogs(opts);
}

export function getDeepSleepRounds(day: string) {
  const { service } = webuiCtx();
  return service.getDeepSleepRounds(day);
}

export async function startSleepBackfill(body?: { from?: string; to?: string; resume?: boolean }) {
  const { service } = webuiCtx();
  const result = await service.startLightSleepBackfill({
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
  const { service } = webuiCtx();
  return service.getLightSleepBackfillStatus();
}
