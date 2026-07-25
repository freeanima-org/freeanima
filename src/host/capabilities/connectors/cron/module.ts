import type { CronJobRow, CronJobUpdateInput } from "@freeanima/host/core/db/pg/cron";
import {
  createCronJob,
  deleteCronJob,
  getCronJob,
  listAllCronJobs,
  updateCronJob,
  upsertBuiltinCronJob,
} from "@freeanima/host/core/db/pg/cron";
import { logComponent } from "@freeanima/host/platform/logging";
import { CronHandleManager } from "./handle-manager.ts";
import {
  purgeInprocessBuiltinRowsFromPg,
  startInprocessBuiltins,
  stopInprocessBuiltins,
} from "./inprocess-builtins.ts";
import { CronJob } from "./models.ts";
import { runJobById } from "./runner.ts";

let handles: CronHandleManager | null = null;

export function getCronHandleManager(): CronHandleManager {
  if (!handles) throw new Error("Cron module not initialized");
  return handles;
}

export function isCronModuleInitialized(): boolean {
  return handles != null;
}

export async function initCronModule(): Promise<void> {
  if (handles) return;
  handles = new CronHandleManager((jobId) => runJobById(jobId));
  await ensureBuiltinCronJobs();
  const purged = await purgeInprocessBuiltinRowsFromPg();
  if (purged > 0) {
    logComponent("cron").info(`purged ${purged} legacy inprocess builtin row(s) from cron_jobs`);
  }
  const jobs = await loadAllJobs();
  handles.syncAll(jobs);
  startInprocessBuiltins();
}

export function stopCronModule(): void {
  stopInprocessBuiltins();
  handles?.stopAll();
  handles = null;
}

/** Tier 2 test injection — clears cron module singleton between cases */
export function resetCronModuleForTests(): void {
  stopCronModule();
}

export {
  getInprocessBuiltinStatus,
  isInprocessBuiltinId,
  listInprocessBuiltinStatuses,
} from "./inprocess-builtins.ts";

export async function loadAllJobs(): Promise<CronJob[]> {
  if (!handles) return [];
  const rows = await listAllCronJobs();
  return rows.map((row: CronJobRow) => CronJob.fromRow(row));
}

export async function getJob(jobId: string): Promise<CronJob | null> {
  const row = await getCronJob(jobId);
  return row ? CronJob.fromRow(row) : null;
}

export function rowToPatch(job: CronJob): CronJobUpdateInput {
  return {
    id: job.id,
    name: job.name,
    schedule: job.schedule,
    prompt: job.prompt,
    skills: job.skills,
    script: job.script,
    no_agent: job.no_agent,
    model_provider: job.model_provider,
    model_name: job.model_name,
    workdir: job.workdir,
    context_from: job.context_from,
    timeout_sec: job.timeout_sec,
    repeat: job.repeat,
    run_count: job.run_count,
    paused: job.paused,
    last_run_at: job.last_run_at > 0 ? new Date(job.last_run_at * 1000) : null,
    last_output_ref: job.last_output_ref,
    notify_on_success: job.notify_on_success,
  };
}

/** PG cron_jobs 仅保留仍需任务表的 builtin（如 email-sync）；其余见 inprocess-builtins */
export async function ensureBuiltinCronJobs(): Promise<void> {
  await ensureBuiltinEmailSyncAllCronJob();
}

async function ensureBuiltinEmailSyncAllCronJob(): Promise<void> {
  const id = "builtin-email-sync-all";
  const scheduleChanged = await upsertBuiltinCronJob({
    id,
    name: "email-sync-all",
    schedule: "*/5 * * * *",
    prompt: "",
    no_agent: true,
    timeout_sec: 1800,
  });
  const job = await getJob(id);
  if (!job || !handles) return;
  if (scheduleChanged) handles.reregister(job);
}

export function cronRowToCreateInput(row: CronJobRow) {
  return { ...row };
}

export async function createCronJobRow(input: Parameters<typeof createCronJob>[0]): Promise<void> {
  await createCronJob(input);
}

export async function updateCronJobRow(patch: CronJobUpdateInput): Promise<boolean> {
  return updateCronJob(patch);
}

export async function deleteCronJobRow(id: string): Promise<boolean> {
  return deleteCronJob(id);
}
