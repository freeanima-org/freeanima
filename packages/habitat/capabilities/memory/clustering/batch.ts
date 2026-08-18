import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/schema/rows";

import { cosineDistance } from "./dbscan.ts";

export type ClusterBatch = {
  /** null = 未分组 */
  clusterId: number | null;
  rows: SemanticMemoryRow[];
  bytes: number;
};

/** reflect 跨族近邻：有 embedding 即可，不依赖簇号 */
export type NeighborEmbedding = {
  entityId: number;
  embedding: number[];
};

/** 单批最多并入的跨族近邻条数（不上设置页） */
export const MAX_REFLECT_NEIGHBORS = 16;

export type ExpandNeighborsOpts = {
  eps: number;
  maxBatchBytes: number;
  maxNeighbors?: number;
};

function rowBytes(row: SemanticMemoryRow): number {
  // 与 reflect 紧凑 JSON 同量级粗估
  const approx = JSON.stringify({
    id: row.id,
    type: row.type,
    content: row.content,
    source_conversations: row.source_conversations,
  });
  return Buffer.byteLength(approx, "utf-8");
}

/**
 * 按 cluster_id 分组；NULL 单独一组；任一组超 maxBatchBytes 再按字节切块。
 */
export function partitionRowsByCluster(
  rows: readonly SemanticMemoryRow[],
  clusterByEntityId: ReadonlyMap<number, number | null>,
  maxBatchBytes: number,
): ClusterBatch[] {
  const groups = new Map<string, SemanticMemoryRow[]>();
  for (const row of rows) {
    const cid = clusterByEntityId.has(row.id) ? (clusterByEntityId.get(row.id) ?? null) : null;
    const key = cid == null ? "null" : String(cid);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const out: ClusterBatch[] = [];
  for (const [key, groupRows] of groups) {
    const clusterId = key === "null" ? null : Number(key);
    let current: SemanticMemoryRow[] = [];
    let bytes = 0;
    const flush = () => {
      if (current.length === 0) return;
      out.push({ clusterId, rows: current, bytes });
      current = [];
      bytes = 0;
    };
    for (const row of groupRows) {
      const b = rowBytes(row);
      if (current.length > 0 && bytes + b > maxBatchBytes) flush();
      current.push(row);
      bytes += b;
      // 单条就超限：仍单独成批，避免死循环
      if (bytes >= maxBatchBytes) flush();
    }
    flush();
  }

  // 稳定顺序：有簇 id 升序，null 最后
  out.sort((a, b) => {
    if (a.clusterId == null && b.clusterId == null) return 0;
    if (a.clusterId == null) return 1;
    if (b.clusterId == null) return -1;
    return a.clusterId - b.clusterId;
  });
  return out;
}

/**
 * 将跨族近邻并入本批作业集（可写）。
 * 未分组（clusterId=null）不扩张。距离键：与本族任一条余弦距离 &lt; eps。
 */
export function expandClusterBatchWithNeighbors(
  batch: ClusterBatch,
  allRows: readonly SemanticMemoryRow[],
  embeddings: readonly NeighborEmbedding[],
  opts: ExpandNeighborsOpts,
): ClusterBatch {
  if (batch.clusterId == null || batch.rows.length === 0) {
    return batch;
  }

  const maxNeighbors = opts.maxNeighbors ?? MAX_REFLECT_NEIGHBORS;
  const inBatch = new Set(batch.rows.map((row) => row.id));
  const embeddingById = new Map<number, number[]>();
  for (const item of embeddings) {
    embeddingById.set(item.entityId, item.embedding);
  }

  const memberEmbeddings: number[][] = [];
  for (const row of batch.rows) {
    const embedding = embeddingById.get(row.id);
    if (embedding) memberEmbeddings.push(embedding);
  }
  if (memberEmbeddings.length === 0) {
    return batch;
  }

  const rowById = new Map<number, SemanticMemoryRow>();
  for (const row of allRows) {
    rowById.set(row.id, row);
  }

  const bestDist = new Map<number, number>();
  for (const candidate of embeddings) {
    if (inBatch.has(candidate.entityId)) continue;
    if (!rowById.has(candidate.entityId)) continue;
    let minDist = Number.POSITIVE_INFINITY;
    for (const member of memberEmbeddings) {
      const dist = cosineDistance(member, candidate.embedding);
      if (dist < minDist) minDist = dist;
    }
    if (minDist < opts.eps) {
      const prev = bestDist.get(candidate.entityId);
      if (prev == null || minDist < prev) {
        bestDist.set(candidate.entityId, minDist);
      }
    }
  }

  const ranked = [...bestDist.entries()].toSorted((a, b) => {
    const byDist = a[1] - b[1];
    if (byDist !== 0) return byDist;
    return a[0] - b[0];
  });

  const added: SemanticMemoryRow[] = [];
  let bytes = batch.bytes;
  for (const [id] of ranked) {
    if (added.length >= maxNeighbors) break;
    const row = rowById.get(id);
    if (!row) continue;
    const extra = rowBytes(row);
    if (bytes + extra > opts.maxBatchBytes) break;
    added.push(row);
    bytes += extra;
  }

  if (added.length === 0) {
    return batch;
  }
  return {
    clusterId: batch.clusterId,
    rows: [...batch.rows, ...added],
    bytes,
  };
}

/** 近邻使批间 id 重叠；送 LLM 前丢掉本轮已 deprecate 的条目 */
export function filterDeprecatedBatchRows(
  rows: readonly SemanticMemoryRow[],
  deprecatedIds: readonly string[],
): SemanticMemoryRow[] {
  if (deprecatedIds.length === 0) {
    return [...rows];
  }
  const banned = new Set(deprecatedIds);
  return rows.filter((row) => !banned.has(String(row.id)));
}
