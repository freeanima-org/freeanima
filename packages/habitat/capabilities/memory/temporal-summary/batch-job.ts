import type { TemporalSummaryWindow } from "@freeanima/habitat/core/db/schema";
import { withRedisLock } from "@freeanima/habitat/core/redis";

const TEMPORAL_BATCH_LOCK_TTL_MS = 2 * 60 * 60 * 1000;

export type TemporalBatchMode = "backfill_missing" | "rebuild_range";

export type TemporalBatchJobStatus = {
  running: boolean;
  mode: TemporalBatchMode | null;
  window: TemporalSummaryWindow | null;
  period_start_from: string | null;
  period_start_to: string | null;
  current: number;
  total: number;
  current_period: string | null;
  completed: string[];
  failed: Array<{ period_start: string; summary: string }>;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  summary: string | null;
};

export type TemporalBatchRegenerateOne = (args: {
  window: TemporalSummaryWindow;
  period_start: string;
}) => Promise<{ ok: boolean; summary: string }>;

export type TemporalBatchLock = <T>(
  fn: () => Promise<T>,
) => Promise<{ status: "ok"; value: T } | { status: "busy" }>;

let jobPromise: Promise<void> | null = null;
let status: TemporalBatchJobStatus = idleStatus();

function idleStatus(): TemporalBatchJobStatus {
  return {
    running: false,
    mode: null,
    window: null,
    period_start_from: null,
    period_start_to: null,
    current: 0,
    total: 0,
    current_period: null,
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
    { key: "temporal-summary-batch", ttlMs: TEMPORAL_BATCH_LOCK_TTL_MS, renew: true, mode: "try" },
    fn,
  );
}

function finishStatus(partial: Partial<TemporalBatchJobStatus>): void {
  status = {
    ...status,
    ...partial,
    running: false,
    current_period: null,
    finished_at: new Date().toISOString(),
  };
}

async function runPeriods(opts: {
  window: TemporalSummaryWindow;
  periods: string[];
  regenerateOne: TemporalBatchRegenerateOne;
  summaryNote?: string;
}): Promise<void> {
  const completed: string[] = [];
  const failed: Array<{ period_start: string; summary: string }> = [];
  let current = 0;
  for (const period_start of opts.periods) {
    status = {
      ...status,
      current_period: period_start,
      current,
      completed: [...completed],
      failed: [...failed],
    };
    try {
      const result = await opts.regenerateOne({
        window: opts.window,
        period_start,
      });
      if (!result.ok) {
        failed.push({ period_start, summary: result.summary });
      } else {
        completed.push(period_start);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ period_start, summary: message });
    }
    current += 1;
    status = {
      ...status,
      current,
      completed: [...completed],
      failed: [...failed],
    };
  }
  const note = opts.summaryNote ?? "";
  const summary = `total=${opts.periods.length} filled=${completed.length} failed=${failed.length}${note}`;
  finishStatus({
    completed,
    failed,
    current,
    error: null,
    summary,
  });
}

/** 后台时间摘要批量任务；已在跑则返回当前状态 */
export function startTemporalBatchJob(opts: {
  mode: TemporalBatchMode;
  window: TemporalSummaryWindow;
  period_start_from: string;
  period_start_to: string;
  periods: string[];
  regenerateOne: TemporalBatchRegenerateOne;
  withLock?: TemporalBatchLock;
  /** 可选说明前缀（如 CST clamp 备注） */
  summaryNote?: string;
}): TemporalBatchJobStatus {
  if (jobPromise) return getTemporalBatchJobStatus();

  const started_at = new Date().toISOString();
  status = {
    ...idleStatus(),
    running: true,
    mode: opts.mode,
    window: opts.window,
    period_start_from: opts.period_start_from,
    period_start_to: opts.period_start_to,
    total: opts.periods.length,
    started_at,
    summary: opts.summaryNote ?? null,
  };

  if (opts.periods.length === 0) {
    const note = opts.summaryNote ?? "";
    finishStatus({
      summary: `total=0 filled=0 failed=0${note}`,
      error: null,
    });
    return getTemporalBatchJobStatus();
  }

  const withLock = opts.withLock ?? defaultLock;

  jobPromise = (async () => {
    const locked = await withLock(async () => {
      await runPeriods({
        window: opts.window,
        periods: opts.periods,
        regenerateOne: opts.regenerateOne,
        ...(opts.summaryNote !== undefined ? { summaryNote: opts.summaryNote } : {}),
      });
    });

    if (locked.status === "busy") {
      finishStatus({
        completed: [],
        failed: [],
        current: 0,
        error: "temporal summary batch already running on another Habitat",
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
  return getTemporalBatchJobStatus();
}

export function getTemporalBatchJobStatus(): TemporalBatchJobStatus {
  return {
    ...status,
    completed: [...status.completed],
    failed: status.failed.map((f) => ({ ...f })),
  };
}

/** Test teardown */
export function resetTemporalBatchJobForTest(): void {
  jobPromise = null;
  status = idleStatus();
}
