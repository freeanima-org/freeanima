import { withRedisLock } from "@freeanima/habitat/core/redis";
import { cstDaySourceRef, notifySoftFailure } from "@freeanima/habitat/core/soft-failure";

import { logPgComponent } from "../log.ts";
import { rebuildAllFtsSegments, type FtsRebuildResult } from "./rebuild.ts";
import type { FtsRebuildPhase, FtsRebuildProgress } from "./rebuild-types.ts";

const log = logPgComponent("embedding");

const FTS_REBUILD_LOCK_TTL_MS = 2 * 60 * 60 * 1000;

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

/** 后台 FTS/embedding 重建；已在跑则返回当前状态（由 Habitat RPC / 管理台显式触发） */
export function startFtsRebuildJob(opts?: { onlyMissing?: boolean }): FtsRebuildJobStatus {
  if (jobPromise) return getFtsRebuildJobStatus();

  const onlyMissing = opts?.onlyMissing ?? true;
  status = {
    ...idleStatus(),
    running: true,
    only_missing: onlyMissing,
    started_at: new Date().toISOString(),
  };

  jobPromise = (async () => {
    const locked = await withRedisLock(
      { key: "fts-rebuild", ttlMs: FTS_REBUILD_LOCK_TTL_MS, renew: true, mode: "try" },
      async () => rebuildAllFtsSegments({ onlyMissing, onProgress }),
    );

    if (locked.status === "busy") {
      status = {
        ...idleStatus(),
        only_missing: onlyMissing,
        running: false,
        started_at: status.started_at,
        finished_at: new Date().toISOString(),
        error: "fts rebuild already running on another Habitat",
      };
      return null as unknown as FtsRebuildResult;
    }

    status = {
      ...status,
      running: false,
      finished_at: new Date().toISOString(),
      result: locked.value,
      error: null,
    };
    return locked.value;
  })()
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      log.error("fts rebuild job failed", { error: message });
      status = {
        ...status,
        running: false,
        finished_at: new Date().toISOString(),
        error: message,
        result: null,
      };
      void notifySoftFailure({
        sourceRef: cstDaySourceRef("fts:rebuild_failed"),
        title: "FTS 重建失败",
        body: ["全量/增量 FTS 重建任务失败。", `错误：${message}`].join("\n"),
        payload: { kind: "fts_rebuild_failed", error: message },
        logLabel: "fts_rebuild",
      });
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
