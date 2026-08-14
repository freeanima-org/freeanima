import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/schema/rows";

export type ClusterBatch = {
  /** null = 未分组 */
  clusterId: number | null;
  rows: SemanticMemoryRow[];
  bytes: number;
};

function rowBytes(row: SemanticMemoryRow): number {
  // 与 reflect 紧凑 JSON 同量级粗估
  const approx = JSON.stringify({
    id: row.id,
    type: row.type,
    content: row.content,
    sources: row.source_conversations,
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
