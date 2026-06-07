import type { CronJobRow, CronJobStorePort, CronJobUpdateInput } from "@freeanima/engine-repos";
import { CronHandleManager } from "./handle-manager.ts";
import { CronJob } from "./models.ts";
import { runJobById } from "./runner.ts";

let store: CronJobStorePort | null = null;
let handles: CronHandleManager | null = null;

export function getCronStore(): CronJobStorePort {
  if (!store) throw new Error("Cron 模块未初始化");
  return store;
}

export function getCronHandleManager(): CronHandleManager {
  if (!handles) throw new Error("Cron 模块未初始化");
  return handles;
}

export function isCronModuleInitialized(): boolean {
  return store != null && handles != null;
}

export async function initCronModule(opts: { store: CronJobStorePort }): Promise<void> {
  store = opts.store;
  handles = new CronHandleManager((jobId) => runJobById(jobId));
  await ensureBuiltinCronJobs();
  const jobs = await loadAllJobs();
  handles.syncAll(jobs);
}

export function stopCronModule(): void {
  handles?.stopAll();
  handles = null;
  store = null;
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
    enabled_toolsets: job.enabled_toolsets,
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
  await _ensureBuiltinLightSleepCronJob();
  await _ensureBuiltinDeepSleepCronJob();
  await _ensureBuiltinSelfAutobiographyCronJob();
}

async function _ensureBuiltinLightSleepCronJob(): Promise<void> {
  const id = "builtin-light-sleep";
  const scheduleChanged = await getCronStore().upsertBuiltin({
    id,
    name: "light-sleep",
    schedule: "0 2 * * *",
    prompt: "",
    no_agent: true,
    deliver: "local",
    timeout_sec: 1800,
  });
  const job = await getJob(id);
  if (!job || !handles) return;
  if (scheduleChanged) handles.reregister(job);
}

async function _ensureBuiltinDeepSleepCronJob(): Promise<void> {
  const id = "builtin-deep-sleep";
  const scheduleChanged = await getCronStore().upsertBuiltin({
    id,
    name: "deep-sleep",
    schedule: "0 3 * * *",
    prompt: "",
    no_agent: true,
    deliver: "local",
    timeout_sec: 3600,
  });
  const job = await getJob(id);
  if (!job || !handles) return;
  if (scheduleChanged) handles.reregister(job);
}

async function _ensureBuiltinSelfAutobiographyCronJob(): Promise<void> {
  const id = "builtin-self-autobiography";
  const scheduleChanged = await getCronStore().upsertBuiltin({
    id,
    name: "self-autobiography",
    schedule: "0 4 * * *",
    prompt: "",
    no_agent: true,
    deliver: "local",
    timeout_sec: 1800,
  });
  const job = await getJob(id);
  if (!job || !handles) return;
  if (scheduleChanged) handles.reregister(job);
}

export function cronRowToCreateInput(row: CronJobRow) {
  return { ...row };
}
