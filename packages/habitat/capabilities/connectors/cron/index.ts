import { randomBytes } from "node:crypto";
import { CronJob } from "./models.ts";
import {
  createCronJobRow,
  deleteCronJobRow,
  getCronHandleManager,
  getJob,
  loadAllJobs,
  updateCronJobRow,
} from "./module.ts";
import { parseSchedule } from "./schedule.ts";

export async function createJob(opts: {
  name: string;
  schedule: string;
  prompt?: string;
  skills?: string[];
  script?: string | null;
  no_agent?: boolean;
  model_provider?: string | null;
  model_name?: string | null;
  workdir?: string | null;
  context_from?: string[];
  timeout_sec?: number;
  repeat?: number | null;
  notify_on_success?: boolean;
}): Promise<CronJob> {
  parseSchedule(opts.schedule);
  const now = new Date();
  const id = randomBytes(8).toString("hex").slice(0, 16);
  await createCronJobRow({
    id,
    name: opts.name,
    schedule: opts.schedule,
    prompt: opts.prompt ?? "",
    skills: opts.skills ?? [],
    script: opts.script ?? null,
    no_agent: opts.no_agent ?? false,
    model_provider: opts.model_provider ?? null,
    model_name: opts.model_name ?? null,
    workdir: opts.workdir ?? null,
    context_from: opts.context_from ?? [],
    timeout_sec: opts.timeout_sec ?? 300,
    repeat: opts.repeat ?? null,
    notify_on_success: opts.notify_on_success ?? false,
    created_at: now,
    updated_at: now,
  });
  const job = await getJob(id);
  if (!job) throw new Error(`cron job not found after create: ${id}`);
  getCronHandleManager().register(job);
  return job;
}

export async function listJobs(): Promise<CronJob[]> {
  return loadAllJobs();
}

export { getJob };

export async function removeJob(jobId: string): Promise<boolean> {
  const job = await getJob(jobId);
  if (!job) return false;
  if (job.builtin) {
    throw new Error(`'${jobId}' is a built-in task and cannot be removed`);
  }
  getCronHandleManager().unregister(jobId);
  return deleteCronJobRow(jobId);
}

export async function pauseJob(jobId: string): Promise<boolean> {
  const job = await getJob(jobId);
  if (!job) return false;
  job.paused = true;
  const ok = await updateCronJobRow({ id: jobId, paused: true });
  if (ok) getCronHandleManager().pause(jobId);
  return ok;
}

export async function resumeJob(jobId: string): Promise<boolean> {
  const job = await getJob(jobId);
  if (!job) return false;
  job.paused = false;
  const ok = await updateCronJobRow({ id: jobId, paused: false });
  if (ok) getCronHandleManager().resume(job);
  return ok;
}

export {
  ensureBuiltinCronJobs,
  initCronModule,
  stopCronModule,
  resetCronModuleForTests,
  isCronModuleInitialized,
  getInprocessBuiltinStatus,
  isInprocessBuiltinId,
  listInprocessBuiltinStatuses,
} from "./module.ts";
export {
  INPROCESS_BUILTIN_DEFS,
  MEMORY_MAINTENANCE_LOCK_KEY,
  SLEEP_PIPELINE_LOCK_KEY,
  type InprocessBuiltinDef,
  type InprocessBuiltinRuntime,
} from "./inprocess-builtins.ts";

export { cronJobDataSchema, cronJobsFileSchema, type CronJobData } from "./schema.ts";
export { CronJob } from "./models.ts";
export { enqueueRunJob, runJob, runJobById } from "./runner.ts";
export { parseSchedule, ScheduleType } from "./schedule.ts";
export { computeNextRunAt, resolveBunSchedule } from "./bun-schedule.ts";
export { cstCronToUtc } from "./timezone.ts";
export {
  deliverToTargets,
  registerCronDeliverer,
  unregisterCronDeliverer,
  type CronDeliverFn,
  type CronDeliverOptions,
  type CronDeliverResult,
  type CronDeliverTarget,
} from "./deliver.ts";
export {
  registerCronBuiltinHandler,
  unregisterCronBuiltinHandler,
  resetCronBuiltinHandlersForTests,
  runCronBuiltinHandler,
} from "./builtin-handlers.ts";
export {
  ensureDirs,
  outputPath,
  resolveScriptPath,
  toOutputRef,
  fromOutputRef,
  readOutputRef,
} from "./paths.ts";
