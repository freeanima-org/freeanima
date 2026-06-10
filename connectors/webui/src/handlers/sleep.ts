import { webuiCtx } from "./runtime.ts";

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
