import { randomBytes } from "node:crypto";
import { formatCstIso } from "@freeanima/kernel-util";
import { CronJob } from "./models.ts";
import * as store from "./store.ts";
import { computeNextRun } from "./schedule.ts";

export function createJob(opts: {
  name: string;
  schedule: string;
  prompt?: string;
  skills?: string[];
  script?: string | null;
  no_agent?: boolean;
  enabled_toolsets?: string[] | null;
  model_provider?: string | null;
  model_name?: string | null;
  workdir?: string | null;
  context_from?: string[];
  deliver?: string;
  timeout_sec?: number;
  repeat?: number | null;
}): CronJob {
  const now = formatCstIso();
  const id = randomBytes(8).toString("hex").slice(0, 16);
  const job = new CronJob({
    id,
    name: opts.name,
    schedule: opts.schedule,
    prompt: opts.prompt ?? "",
    skills: opts.skills ?? [],
    script: opts.script ?? null,
    no_agent: opts.no_agent ?? false,
    enabled_toolsets: opts.enabled_toolsets ?? null,
    model_provider: opts.model_provider ?? null,
    model_name: opts.model_name ?? null,
    workdir: opts.workdir ?? null,
    context_from: opts.context_from ?? [],
    deliver: opts.deliver ?? "local",
    timeout_sec: opts.timeout_sec ?? 300,
    repeat: opts.repeat ?? null,
    created_at: now,
    updated_at: now,
  });
  const next = computeNextRun(opts.schedule, Date.now() / 1000);
  if (next != null) job.next_run_at = next;
  store.add(job);
  return job;
}

export function listJobs(): CronJob[] {
  return store.loadAll();
}

export function getJob(jobId: string): CronJob | null {
  return store.find(jobId);
}

export function removeJob(jobId: string): boolean {
  const job = store.find(jobId);
  if (!job) return false;
  if (job.builtin) {
    throw new Error(`'${jobId}' is a built-in task and cannot be removed`);
  }
  return store.remove(jobId);
}

export function pauseJob(jobId: string): boolean {
  const job = store.find(jobId);
  if (!job) return false;
  job.paused = true;
  job.next_run_at = 0;
  return store.update(job);
}

export function resumeJob(jobId: string): boolean {
  const job = store.find(jobId);
  if (!job) return false;
  job.paused = false;
  const next = computeNextRun(job.schedule);
  job.next_run_at = next ?? 0;
  return store.update(job);
}

export function ensureBuiltinCronJobs(): void {
  // 内置任务由 connectors/cron 按需注册；L2 gap-fill 已移除（PG FTS 自动维护）
}

export { cronJobDataSchema, cronJobsFileSchema, type CronJobData } from "./schema.ts";
export { CronJob } from "./models.ts";
export { Scheduler, POLL_INTERVAL_MS } from "./scheduler.ts";
export { enqueueRunJob, runJob } from "./runner.ts";
export { computeNextRun, parseSchedule, ScheduleType } from "./schedule.ts";
export {
  deliverCronResult,
  registerCronDeliverer,
  unregisterCronDeliverer,
  resolveDeliverTargets,
  type CronDeliverFn,
  type CronDeliverPayload,
  type CronDeliverTarget,
} from "./deliver.ts";
export * as cronStore from "./store.ts";
