/**
 * 朴素 DBSCAN（余弦距离），现算距离，禁止物化 n×n 矩阵。
 * 标签：cluster id ≥ 0；噪声 / 未成簇 = -1。
 */

export type DbscanPoint = {
  id: number;
  /** 建议已 L2 归一化；未归一化时距离仍用余弦 */
  embedding: number[];
};

export type DbscanOptions = {
  eps: number;
  minPoints: number;
  /** 每处理多少点让出事件循环（默认 64） */
  yieldEvery?: number;
};

export type DbscanResult = {
  /** point.id → cluster label（噪声为 -1） */
  labels: Map<number, number>;
  clusterCount: number;
  noiseCount: number;
};

/** 余弦距离 ∈ [0, 2]；零向量视为距离 2 */
export function cosineDistance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 2;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na <= 0 || nb <= 0) return 2;
  const sim = dot / (Math.sqrt(na) * Math.sqrt(nb));
  const clamped = Math.max(-1, Math.min(1, sim));
  return 1 - clamped;
}

function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(() => {
      resolve();
    });
  });
}

export async function runDbscan(
  points: readonly DbscanPoint[],
  opts: DbscanOptions,
): Promise<DbscanResult> {
  const eps = opts.eps;
  const minPoints = Math.max(1, opts.minPoints);
  const yieldEvery = opts.yieldEvery ?? 64;
  const n = points.length;
  const labels = Array.from({ length: n }, () => -2); // -2 = unvisited
  let nextCluster = 0;
  let noiseCount = 0;
  let processed = 0;

  const regionQuery = (i: number): number[] => {
    const pi = points[i];
    if (!pi) return [];
    const neighbors: number[] = [];
    for (let j = 0; j < n; j++) {
      const pj = points[j];
      if (!pj) continue;
      if (cosineDistance(pi.embedding, pj.embedding) <= eps) neighbors.push(j);
    }
    return neighbors;
  };

  for (let i = 0; i < n; i++) {
    processed += 1;
    if (processed % yieldEvery === 0) await yieldEventLoop();

    if (labels[i] !== -2) continue;
    const neighbors = regionQuery(i);
    if (neighbors.length < minPoints) {
      labels[i] = -1;
      noiseCount += 1;
      continue;
    }

    const clusterId = nextCluster;
    nextCluster += 1;
    labels[i] = clusterId;

    const seed = neighbors.filter((j) => j !== i);
    const seedSet = new Set(seed);
    for (let s = 0; s < seed.length; s++) {
      if (s > 0 && s % yieldEvery === 0) await yieldEventLoop();
      const j = seed[s];
      if (j === undefined) continue;
      const prev = labels[j];
      if (prev === -1) {
        labels[j] = clusterId;
        noiseCount -= 1;
      }
      if (prev !== -2 && prev !== -1) continue;
      labels[j] = clusterId;
      const jNeighbors = regionQuery(j);
      if (jNeighbors.length >= minPoints) {
        for (const k of jNeighbors) {
          if (!seedSet.has(k)) {
            seedSet.add(k);
            seed.push(k);
          }
        }
      }
    }
  }

  const labelMap = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const p = points[i];
    if (!p) continue;
    const lab = labels[i] ?? -1;
    labelMap.set(p.id, lab < 0 ? -1 : lab);
  }

  return {
    labels: labelMap,
    clusterCount: nextCluster,
    noiseCount,
  };
}
