import type { CronJob } from "./models";
import { logComponent } from "@freeanima/legacy-kernel";
import * as store from "./store";
import { computeNextRun } from "./schedule";

export const POLL_INTERVAL_MS = 10_000;

export type RunJobFn = (job: CronJob) => void | Promise<void>;

export class Scheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private runJob: RunJobFn | null = null;
  private running = false;
  private readonly runningIds = new Set<string>();

  start(runJob: RunJobFn): void {
    if (this.timer) return;
    this.runJob = runJob;
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.runJob = null;
    this.runningIds.clear();
  }

  get isRunning(): boolean {
    return this.timer != null;
  }

  /** 测试用：当前正在执行的任务 id */
  getRunningJobIds(): string[] {
    return [...this.runningIds];
  }

  rescheduleAll(): void {
    const jobs = store.loadAll();
    let changed = false;
    const now = Date.now() / 1000;
    for (const job of jobs) {
      if (job.paused) {
        if (job.next_run_at !== 0) {
          job.next_run_at = 0;
          changed = true;
        }
        continue;
      }
      if (job.next_run_at === 0 || job.next_run_at < now) {
        const next = computeNextRun(job.schedule, now);
        if (next != null) {
          job.next_run_at = next;
          changed = true;
        }
      }
    }
    if (changed) store.saveAll(jobs);
  }

  scheduleJob(job: CronJob): void {
    if (job.paused) {
      job.next_run_at = 0;
    } else {
      const next = computeNextRun(job.schedule, Date.now() / 1000);
      job.next_run_at = next ?? 0;
    }
    store.update(job);
  }

  private async tick(): Promise<void> {
    if (this.running || !this.runJob) return;
    this.running = true;
    try {
      const now = Date.now() / 1000;
      const jobs = store.loadAll();
      for (const job of jobs) {
        if (job.paused) continue;
        if (job.next_run_at <= 0 || job.next_run_at > now) continue;
        if (this.runningIds.has(job.id)) continue;
        if (job.repeat != null && job.run_count >= job.repeat) {
          job.paused = true;
          store.update(job);
          continue;
        }
        this.runningIds.add(job.id);
        void Promise.resolve(this.runJob(job))
          .catch((err) => {
            logComponent("cron").error(`Cron job ${job.id.slice(0, 12)} failed`, {
              err,
              job_id: job.id,
            });
          })
          .finally(() => {
            this.runningIds.delete(job.id);
          });
      }
    } finally {
      this.running = false;
    }
  }
}
