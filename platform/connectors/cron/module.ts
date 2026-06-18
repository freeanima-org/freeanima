import type {
  CronJobRow,
  CronJobStorePort,
  CronJobUpdateInput,
  CronLogStorePort,
} from "@freeanima/core/repos";
import { setCronLogStore } from "./cron-log.ts";
import { CronHandleManager } from "./handle-manager.ts";
import { CronJob } from "./models.ts";
import { runJobById } from "./runner.ts";

let store: CronJobStorePort | null = null;
let handles: CronHandleManager | null = null;

export function getCronStore(): CronJobStorePort {
  if (!store) throw new Error("Cron module not initialized");
  return store;
}

export function getCronHandleManager(): CronHandleManager {
  if (!handles) throw new Error("Cron module not initialized");
  return handles;
}

export function isCronModuleInitialized(): boolean {
  return store != null && handles != null;
}

export async function initCronModule(opts: {
  store: CronJobStorePort;
  logStore?: CronLogStorePort;
}): Promise<void> {
  store = opts.store;
  setCronLogStore(opts.logStore ?? null);
  handles = new CronHandleManager((jobId) => runJobById(jobId));
  await ensureBuiltinCronJobs();
  const jobs = await loadAllJobs();
  handles.syncAll(jobs);
}

export function stopCronModule(): void {
  handles?.stopAll();
  handles = null;
  store = null;
  setCronLogStore(null);
}

export async function loadAllJobs(): Promise<CronJob[]> {
  if (!store) return [];
  const rows = await store.listAll();
  return rows.map((row) => CronJob.fromRow(row));
}

export async function getJob(jobId: string): Promise<CronJob | null> {
  if (!store) return null;
  const row = await store.get(jobId);
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
    deliver: job.deliver,
    timeout_sec: job.timeout_sec,
    repeat: job.repeat,
    run_count: job.run_count,
    paused: job.paused,
    last_run_at: job.last_run_at > 0 ? new Date(job.last_run_at * 1000).toISOString() : null,
    last_output_ref: job.last_output_ref,
  };
}

export async function ensureBuiltinCronJobs(): Promise<void> {
  await _ensureBuiltinSleepCycleCronJob();
}

async function _ensureBuiltinSleepCycleCronJob(): Promise<void> {
  const id = "builtin-sleep-cycle";
  const scheduleChanged = await getCronStore().upsertBuiltin({
    id,
    name: "sleep-cycle",
    schedule: "0 2 * * *",
    prompt: "",
    no_agent: true,
    deliver: "local",
    timeout_sec: 7200,
  });
  const job = await getJob(id);
  if (!job || !handles) return;
  if (scheduleChanged) handles.reregister(job);
}

export function cronRowToCreateInput(row: CronJobRow) {
  return { ...row };
}
