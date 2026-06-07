import { logComponent } from "@freeanima/service-logging";
import type { CronJob } from "./models.ts";
import { resolveBunSchedule } from "./bun-schedule.ts";

export type CronFireFn = (jobId: string) => void | Promise<void>;

type HandleEntry = {
  cronHandle?: { stop(): void };
  oneshotTimer?: ReturnType<typeof setTimeout>;
  retryTimer?: ReturnType<typeof setTimeout>;
  schedule: string;
};

const FAILURE_RETRY_DELAY_SEC = 300;

export class CronHandleManager {
  private readonly entries = new Map<string, HandleEntry>();
  private readonly fireJob: CronFireFn;

  constructor(fireJob: CronFireFn) {
    this.fireJob = fireJob;
  }

  register(job: CronJob): void {
    if (job.paused) return;
    if (job.repeat != null && job.run_count >= job.repeat) return;

    this.unregister(job.id);

    const resolved = resolveBunSchedule(job.schedule);
    const entry: HandleEntry = { schedule: job.schedule };

    if (resolved.kind === "oneshot") {
      const delayMs = Math.max(0, resolved.atMs - Date.now());
      entry.oneshotTimer = setTimeout(() => {
        void this.onFire(job.id);
      }, delayMs);
    } else {
      entry.cronHandle = Bun.cron(resolved.expr, () => {
        void this.onFire(job.id);
      });
    }

    this.entries.set(job.id, entry);
  }

  unregister(jobId: string): void {
    const entry = this.entries.get(jobId);
    if (!entry) return;
    entry.cronHandle?.stop();
    if (entry.oneshotTimer) clearTimeout(entry.oneshotTimer);
    if (entry.retryTimer) clearTimeout(entry.retryTimer);
    this.entries.delete(jobId);
  }

  pause(jobId: string): void {
    this.unregister(jobId);
  }

  resume(job: CronJob): void {
    this.register(job);
  }

  /** schedule 变化时：stop 旧 handle 再注册新表达式 */
  reregister(job: CronJob): void {
    this.unregister(job.id);
    this.register(job);
  }

  syncAll(jobs: CronJob[]): void {
    const activeIds = new Set<string>();
    for (const job of jobs) {
      if (job.paused) continue;
      if (job.repeat != null && job.run_count >= job.repeat) continue;
      activeIds.add(job.id);
      const existing = this.entries.get(job.id);
      if (existing && existing.schedule === job.schedule) continue;
      this.register(job);
    }
    for (const id of [...this.entries.keys()]) {
      if (!activeIds.has(id)) this.unregister(id);
    }
  }

  scheduleRetry(jobId: string): void {
    const entry = this.entries.get(jobId);
    if (entry?.retryTimer) clearTimeout(entry.retryTimer);

    const retryTimer = setTimeout(() => {
      void this.fireJob(jobId);
    }, FAILURE_RETRY_DELAY_SEC * 1000);

    if (entry) {
      entry.retryTimer = retryTimer;
      entry.cronHandle?.stop();
      entry.cronHandle = undefined;
    } else {
      this.entries.set(jobId, { schedule: "", retryTimer });
    }
  }

  stopAll(): void {
    for (const id of [...this.entries.keys()]) {
      this.unregister(id);
    }
  }

  private async onFire(jobId: string): Promise<void> {
    try {
      await this.fireJob(jobId);
    } catch (err) {
      logComponent("cron").error(`Cron job ${jobId.slice(0, 12)} failed`, { err, job_id: jobId });
    }
  }
}
