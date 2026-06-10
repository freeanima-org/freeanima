import { getServiceContext } from "@freeanima/service-api";

export async function getSleepSummary() {
  const { service } = getServiceContext();
  return service.getSleepSummary();
}

export async function listSleepRuns(opts?: { limit?: number; offset?: number; ok?: boolean }) {
  const { service } = getServiceContext();
  return service.listSleepRuns(opts);
}

export async function listCronLogs(opts?: {
  job_id?: string;
  limit?: number;
  offset?: number;
  ok?: boolean;
}) {
  const { service } = getServiceContext();
  return service.listCronLogs(opts);
}

export function getDeepSleepRounds(day: string) {
  const { service } = getServiceContext();
  return service.getDeepSleepRounds(day);
}
