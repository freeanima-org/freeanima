import { logComponent } from "@freeanima/platform/logging";

import { rebuildAllFtsSegments, type FtsRebuildResult } from "./rebuild.ts";
import type { FtsRebuildPhase, FtsRebuildProgress } from "./rebuild-types.ts";

const log = logComponent("embedding");

export type FtsRebuildJobStatus = {
  running: boolean;
  phase: FtsRebuildPhase | null;
  table: string | null;
  current: number;
  total: number;
  only_missing: boolean;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  result: FtsRebuildResult | null;
};

let jobPromise: Promise<FtsRebuildResult> | null = null;
let status: FtsRebuildJobStatus = idleStatus();

function idleStatus(): FtsRebuildJobStatus {
  return {
    running: false,
    phase: null,
    table: null,
    current: 0,
    total: 0,
    only_missing: true,
    started_at: null,
    finished_at: null,
    error: null,
    result: null,
  };
}

function onProgress(progress: FtsRebuildProgress): void {
  status = {
    ...status,
    phase: progress.phase,
    table: progress.table,
    current: progress.current,
    total: progress.total,
  };
}

/** Background rebuild on startup; returns current state if already running */
export function startFtsRebuildJob(opts?: { onlyMissing?: boolean }): FtsRebuildJobStatus {
  if (jobPromise) return getFtsRebuildJobStatus();

  const onlyMissing = opts?.onlyMissing ?? true;
  status = {
    ...idleStatus(),
    running: true,
    only_missing: onlyMissing,
    started_at: new Date().toISOString(),
  };

  jobPromise = rebuildAllFtsSegments({ onlyMissing, onProgress })
    .then((result) => {
      status = {
        ...status,
        running: false,
        finished_at: new Date().toISOString(),
        result,
        error: null,
      };
      return result;
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      log.error("fts rebuild job failed", { error: message });
      status = {
        ...status,
        running: false,
        finished_at: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
        result: null,
      };
      throw err;
    })
    .finally(() => {
      jobPromise = null;
    });

  void jobPromise.catch(() => {});
  return getFtsRebuildJobStatus();
}

export function getFtsRebuildJobStatus(): FtsRebuildJobStatus {
  return { ...status };
}

/** Test teardown */
export function resetFtsRebuildJobForTest(): void {
  jobPromise = null;
  status = idleStatus();
}
