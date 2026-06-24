import type { ClientLease } from "./client-pool.ts";
import type { AcpClientPool } from "./client-pool.ts";

export type AsyncLaunchSpec = {
  taskId: string;
  agentName: string;
  prompt: string;
  context: string;
  animaSessionId: string;
  acpSessionId?: string;
  newConversation?: boolean;
  mode?: "agent" | "plan" | "ask";
  timeoutMinutes: number;
  enqueuedAt: number;
  deadlineAt: number;
  wasQueued: boolean;
};

export type EnqueueResult = {
  taskId: string;
  status: "started" | "queued";
  queuePosition?: number;
};

export type TaskSchedulerCallbacks = {
  onStart: (spec: AsyncLaunchSpec, lease: ClientLease) => Promise<void>;
  onQueueTimeout: (spec: AsyncLaunchSpec) => Promise<void>;
};

type RunningEntry = {
  spec: AsyncLaunchSpec;
  lease: ClientLease;
};

/** FIFO scheduler: running tasks hold pool leases; queued tasks wait for slots */
export class AcpTaskScheduler {
  private readonly pending: AsyncLaunchSpec[] = [];
  private readonly running = new Map<string, RunningEntry>();
  private draining = false;
  private startingCount = 0;

  constructor(
    private readonly pool: AcpClientPool,
    readonly maxConcurrent: number,
    private readonly callbacks: TaskSchedulerCallbacks,
  ) {}

  get runningCount(): number {
    return this.running.size;
  }

  get queuedCount(): number {
    return this.pending.length;
  }

  private canStartMore(): boolean {
    return this.running.size + this.startingCount < this.maxConcurrent;
  }

  hasCapacity(): boolean {
    return this.canStartMore();
  }

  getQueuePosition(taskId: string): number | undefined {
    const idx = this.pending.findIndex((s) => s.taskId === taskId);
    return idx >= 0 ? idx + 1 : undefined;
  }

  isRunning(taskId: string): boolean {
    return this.running.has(taskId);
  }

  isQueued(taskId: string): boolean {
    return this.pending.some((s) => s.taskId === taskId);
  }

  getLease(taskId: string): ClientLease | undefined {
    return this.running.get(taskId)?.lease ?? this.pool.findLease(taskId);
  }

  enqueue(spec: AsyncLaunchSpec): EnqueueResult {
    if (this.canStartMore()) {
      void this.startSpec(spec);
      return { taskId: spec.taskId, status: "started" };
    }
    this.pending.push(spec);
    return {
      taskId: spec.taskId,
      status: "queued",
      queuePosition: this.pending.length,
    };
  }

  cancelQueued(taskId: string): boolean {
    const idx = this.pending.findIndex((s) => s.taskId === taskId);
    if (idx < 0) return false;
    this.pending.splice(idx, 1);
    return true;
  }

  onTaskTerminal(taskId: string): void {
    const entry = this.running.get(taskId);
    if (entry) {
      this.pool.release(entry.lease);
      this.running.delete(taskId);
    }
    void this.drainQueue();
  }

  cancelAll(reason: string): void {
    void reason;
    this.pending.length = 0;
    for (const [taskId] of this.running) {
      const lease = this.running.get(taskId)?.lease;
      if (lease) this.pool.abortPrompt(lease);
    }
  }

  private async startSpec(spec: AsyncLaunchSpec): Promise<void> {
    this.startingCount++;
    try {
      if (Date.now() > spec.deadlineAt) {
        await this.callbacks.onQueueTimeout(spec);
        return;
      }
      const lease = await this.pool.tryAcquire(spec.taskId);
      if (!lease) {
        this.pending.unshift(spec);
        return;
      }
      this.running.set(spec.taskId, { spec, lease });
      try {
        await this.callbacks.onStart(spec, lease);
      } catch {
        this.onTaskTerminal(spec.taskId);
      }
    } finally {
      this.startingCount = Math.max(0, this.startingCount - 1);
    }
  }

  private async drainQueue(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.pending.length > 0 && this.canStartMore()) {
        const spec = this.pending.shift()!;
        await this.startSpec(spec);
      }
    } finally {
      this.draining = false;
    }
  }
}
