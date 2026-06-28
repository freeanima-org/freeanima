import {
  getFtsCoverageStats,
  getFtsRebuildJobStatus as readFtsRebuildJobStatus,
  startFtsRebuildJob,
  type FtsCoverageStats,
  type FtsRebuildJobStatus,
} from "@freeanima/core/db/pg";
import {
  getCjkConfigSnapshot,
  getEmbeddingConfigSnapshot,
  type CjkConfigSnapshot,
  type EmbeddingConfigSnapshot,
} from "@freeanima/platform/config";
import type { RuntimeDeps } from "./runtime-deps.ts";

export type { CjkConfigSnapshot, EmbeddingConfigSnapshot, FtsCoverageStats, FtsRebuildJobStatus };

export type FtsStatusSnapshot = CjkConfigSnapshot & {
  embedding: EmbeddingConfigSnapshot;
  coverage: FtsCoverageStats | null;
  rebuild: FtsRebuildJobStatus;
};

export async function getFtsStatus(deps: RuntimeDeps): Promise<FtsStatusSnapshot> {
  let coverage: FtsCoverageStats | null = null;
  try {
    coverage = await getFtsCoverageStats();
  } catch {
    coverage = null;
  }
  const cfg = deps.engine.config.data;
  return {
    ...getCjkConfigSnapshot(cfg),
    embedding: getEmbeddingConfigSnapshot(cfg),
    coverage,
    rebuild: readFtsRebuildJobStatus(),
  };
}

/** Background rebuild on startup (default: fill missing rows only; resumable) */
export function startRebuildFtsIndex(opts?: { onlyMissing?: boolean }): FtsRebuildJobStatus {
  return startFtsRebuildJob(opts);
}

export function getRebuildFtsJobStatus(): FtsRebuildJobStatus {
  return readFtsRebuildJobStatus();
}
