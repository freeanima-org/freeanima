import { withRedisLock } from "@freeanima/habitat/core/redis";

import type { SysRollKind } from "./buckets.ts";

const TEMPORAL_SYSTEM_ROLL_BATCH_LOCK_TTL_MS = 2 * 60 * 60 * 1000;

export const ALL_SYS_ROLL_KINDS: SysRollKind[] = ["past_days", "past_months", "past_years"];

export type TemporalSystemRollBatchJobStatus = {
  running: boolean;
  kinds: SysRollKind[] | null;
  current: number;
  total: number;
  current_kind: SysRollKind | null;
  completed: SysRollKind[];
  failed: Array<{ kind: SysRollKind; summary: string }>;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  summary: string | null;
};

export type TemporalSystemRollRegenerateOne = (
  kind: SysRollKind,
) => Promise<{ ok: boolean; summary?: string }>;

export type TemporalSystemRollBatchLock = <T>(
  fn: () => Promise<T>,
) => Promise<{ status: "ok"; value: T } | { status: "busy" }>;

let jobPromise: Promise<void> | null = null;
let status: TemporalSystemRollBatchJobStatus = idleStatus();

function idleStatus(): TemporalSystemRollBatchJobStatus {
  return {
    running: false,
    kinds: null,
    current: 0,
    total: 0,
    current_kind: null,
    completed: [],
    failed: [],
    started_at: null,
    finished_at: null,
    error: null,
    summary: null,
  };
}

function defaultLock<T>(
  fn: () => Promise<T>,
): Promise<{ status: "ok"; value: T } | { status: "busy" }> {
  return withRedisLock(
    {
      key: "temporal-summary-system-roll-batch",
      ttlMs: TEMPORAL_SYSTEM_ROLL_BATCH_LOCK_TTL_MS,
      renew: true,
      mode: "try",
    },
    fn,
  );
}

function finishStatus(partial: Partial<TemporalSystemRollBatchJobStatus>): void {
  status = {
    ...status,
    ...partial,
    running: false,
    current_kind: null,
    finished_at: new Date().toISOString(),
  };
}

async function runKinds(opts: {
  kinds: SysRollKind[];
  regenerateOne: TemporalSystemRollRegenerateOne;
}): Promise<void> {
  const completed: SysRollKind[] = [];
  const failed: Array<{ kind: SysRollKind; summary: string }> = [];
  let current = 0;
  for (const kind of opts.kinds) {
    status = {
      ...status,
      current_kind: kind,
      current,
      completed: [...completed],
      failed: [...failed],
    };
    try {
      const result = await opts.regenerateOne(kind);
      if (!result.ok) {
        failed.push({ kind, summary: result.summary ?? "regenerate failed" });
      } else {
        completed.push(kind);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ kind, summary: message });
    }
    current += 1;
    status = {
      ...status,
      current,
      completed: [...completed],
      failed: [...failed],
    };
  }
  finishStatus({
    completed,
    failed,
    current,
    error: null,
    summary: `total=${opts.kinds.length} filled=${completed.length} failed=${failed.length}`,
  });
}

/** 后台系统汇总批量任务；已在跑则返回当前状态 */
export function startTemporalSystemRollBatchJob(opts: {
  kinds: SysRollKind[];
  regenerateOne: TemporalSystemRollRegenerateOne;
  withLock?: TemporalSystemRollBatchLock;
}): TemporalSystemRollBatchJobStatus {
  if (jobPromise) return getTemporalSystemRollBatchJobStatus();

  const kinds = opts.kinds.length > 0 ? opts.kinds : ALL_SYS_ROLL_KINDS;
  status = {
    ...idleStatus(),
    running: true,
    kinds: [...kinds],
    total: kinds.length,
    started_at: new Date().toISOString(),
  };

  if (kinds.length === 0) {
    finishStatus({
      summary: "total=0 filled=0 failed=0",
      error: null,
    });
    return getTemporalSystemRollBatchJobStatus();
  }

  const withLock = opts.withLock ?? defaultLock;

  jobPromise = (async () => {
    const locked = await withLock(async () => {
      await runKinds({ kinds, regenerateOne: opts.regenerateOne });
    });

    if (locked.status === "busy") {
      finishStatus({
        completed: [],
        failed: [],
        current: 0,
        error: "temporal system roll batch already running on another Habitat",
        summary: null,
      });
    }
  })()
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      finishStatus({
        error: message,
        summary: status.summary,
      });
    })
    .finally(() => {
      jobPromise = null;
    });

  void jobPromise;
  return getTemporalSystemRollBatchJobStatus();
}

export function getTemporalSystemRollBatchJobStatus(): TemporalSystemRollBatchJobStatus {
  return {
    ...status,
    kinds: status.kinds ? [...status.kinds] : null,
    completed: [...status.completed],
    failed: status.failed.map((f) => ({ ...f })),
  };
}

/** Test teardown */
export function resetTemporalSystemRollBatchJobForTest(): void {
  jobPromise = null;
  status = idleStatus();
}
