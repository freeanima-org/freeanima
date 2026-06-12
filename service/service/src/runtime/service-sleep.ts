import type { CronLogListOpts, CronLogRow } from "@freeanima/storage-repos";
import {
  buildSleepSummary,
  listDeepSleepRoundLogs,
  SLEEP_JOB_IDS,
  type SleepSummary,
} from "@freeanima/capabilities-memory";

import { getServiceContext } from "../context.ts";
import { listCronJobs } from "./service-status.ts";

export async function getSleepSummary(): Promise<SleepSummary> {
  const { jobs } = await listCronJobs();
  return buildSleepSummary(
    jobs.map((j) => ({
      id: j.id,
      name: j.name,
      paused: j.paused,
      run_count: j.run_count,
      last_run_at: j.last_run_at > 0 ? new Date(j.last_run_at * 1000).toISOString() : null,
    })),
  );
}

export async function listSleepRuns(opts?: {
  limit?: number;
  offset?: number;
  ok?: boolean;
}): Promise<{ items: CronLogRow[]; total: number }> {
  const { engine } = getServiceContext();
  if (!engine.repos.pgAvailable) {
    return { items: [], total: 0 };
  }

  const listOpts: CronLogListOpts = {
    job_ids: [...SLEEP_JOB_IDS],
    limit: opts?.limit ?? 50,
    offset: opts?.offset ?? 0,
    ok: opts?.ok,
  };
  const items = await engine.repos.cronLog.list(listOpts);
  return { items, total: items.length };
}

export async function listCronLogs(opts?: {
  job_id?: string;
  limit?: number;
  offset?: number;
  ok?: boolean;
}): Promise<{ items: CronLogRow[]; total: number }> {
  const { engine } = getServiceContext();
  if (!engine.repos.pgAvailable) {
    return { items: [], total: 0 };
  }

  const items = await engine.repos.cronLog.list({
    job_id: opts?.job_id,
    limit: opts?.limit ?? 50,
    offset: opts?.offset ?? 0,
    ok: opts?.ok,
  });
  return { items, total: items.length };
}

export function getDeepSleepRounds(day: string) {
  return { day, rounds: listDeepSleepRoundLogs(day) };
}
