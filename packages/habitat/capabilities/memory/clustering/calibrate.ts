import { getActiveRuntimeConfig } from "@freeanima/habitat/core/config";
import {
  resolveMemoryClusteringConfig,
  type ResolvedMemoryClusteringConfig,
} from "@freeanima/habitat/core/config";
import { isEmbeddingEnabled } from "@freeanima/habitat/core/config";
import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import {
  listActiveSemanticMemoryEmbeddings,
  findNearestClusteredNeighbor,
} from "@freeanima/habitat/core/db/pg/search/clustering-repo.ts";
import {
  patchEntitySearchDocumentClusterIds,
  setSearchDocumentClusterId,
} from "@freeanima/habitat/core/db/pg/search/pg-search-index/backend.ts";
import { cstDaySourceRef, notifySoftFailure } from "@freeanima/habitat/core/soft-failure";

import { runHdbscan } from "./hdbscan.ts";

const log = logComponent("memory.clustering");

export type CalibrateFullResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  n?: number;
  clusterCount?: number;
  noiseCount?: number;
  updated?: number;
};

export async function calibrateSemanticMemoryClusters(opts?: {
  config?: ResolvedMemoryClusteringConfig;
}): Promise<CalibrateFullResult> {
  const cfg = opts?.config ?? resolveMemoryClusteringConfig(getActiveRuntimeConfig().data);
  if (!cfg.enabled) {
    return { ok: true, skipped: true, reason: "clustering_disabled" };
  }
  if (!isEmbeddingEnabled(getActiveRuntimeConfig().data)) {
    return { ok: true, skipped: true, reason: "embedding_disabled" };
  }

  const rows = await listActiveSemanticMemoryEmbeddings();
  const n = rows.length;
  if (n === 0) {
    return { ok: true, skipped: true, reason: "empty", n: 0 };
  }
  if (n > cfg.max_calibrate_n) {
    const reason = `max_calibrate_n:${n}>${cfg.max_calibrate_n}`;
    log.warn("full HDBSCAN skipped", { n, max: cfg.max_calibrate_n });
    void notifySoftFailure({
      sourceRef: cstDaySourceRef("memory:cluster_calibrate_skipped"),
      title: "语义记忆聚类校准跳过",
      body: [
        "全量 HDBSCAN 因条数超过上限已跳过（保护 2C2G）。",
        `n=${n}`,
        `max_calibrate_n=${cfg.max_calibrate_n}`,
        "reflect 仍可按已有 cluster_id / NULL 分批。",
      ].join("\n"),
      payload: { kind: "cluster_calibrate_skipped", n, max_calibrate_n: cfg.max_calibrate_n },
      logLabel: "memory.clustering",
    });
    return { ok: true, skipped: true, reason, n };
  }

  const started = Date.now();
  const result = await runHdbscan(
    rows.map((r) => ({ id: r.entityId, embedding: r.embedding })),
    {
      minClusterSize: cfg.min_points,
      minSamples: cfg.min_samples,
      peelSmall: cfg.peel_small,
    },
  );

  const patches: Array<{ sourceId: number; clusterId: number | null }> = [];
  for (const [id, label] of result.labels) {
    patches.push({ sourceId: id, clusterId: label < 0 ? null : label });
  }
  const updated = await patchEntitySearchDocumentClusterIds(patches);

  log.info("full HDBSCAN calibrated", {
    n,
    clusterCount: result.clusterCount,
    noiseCount: result.noiseCount,
    updated,
    ms: Date.now() - started,
  });

  return {
    ok: true,
    n,
    clusterCount: result.clusterCount,
    noiseCount: result.noiseCount,
    updated,
  };
}

/**
 * 增量标簇：挂靠最近已标簇邻居（HNSW）；距离 ≥ eps 则保持 NULL，留给周校准。
 * Fail-open：调用方应吞异常。
 */
export async function assignIncrementalCluster(
  entityId: number,
  embedding: number[],
  opts?: { config?: ResolvedMemoryClusteringConfig },
): Promise<number | null> {
  const cfg = opts?.config ?? resolveMemoryClusteringConfig(getActiveRuntimeConfig().data);
  if (!cfg.enabled) return null;

  const nearest = await findNearestClusteredNeighbor(embedding, { excludeEntityId: entityId });
  const clusterId = nearest && nearest.distance < cfg.eps ? nearest.clusterId : null;

  await setSearchDocumentClusterId("entity", entityId, clusterId);
  return clusterId;
}
