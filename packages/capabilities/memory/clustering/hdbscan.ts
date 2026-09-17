/**
 * 轻量 HDBSCAN：mutual-reachability MST + 真分裂切边。
 * 现算距离，禁止物化 n×n；标签契约对齐 DBSCAN：簇 id ≥ 0，噪声 = -1。
 *
 * 默认只切断「两侧皆 ≥ minClusterSize」的边，靠结构形成簇、减少噪声；
 * 不做噪声事后挂靠。可选 peelSmall 会剥落小侧（更干净但未分组↑）。
 */

import { cosineDistance, type DbscanPoint, type DbscanResult } from "./dbscan.ts";

export type HdbscanOptions = {
  /** 最小簇大小（≈ 原 min_points / HDBSCAN min_cluster_size） */
  minClusterSize: number;
  /** 核心距离邻域点数；默认 minClusterSize-1 */
  minSamples?: number;
  /**
   * 是否剥落「一侧 &lt; minClusterSize」的松边。
   * false（默认）：少噪声；true：簇更纯、未分组更多。
   */
  peelSmall?: boolean;
  yieldEvery?: number;
};

function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(() => {
      resolve();
    });
  });
}

type MstEdge = { a: number; b: number; weight: number };

async function computeCoreDistances(
  points: readonly DbscanPoint[],
  minSamples: number,
  yieldEvery: number,
): Promise<Float64Array> {
  const n = points.length;
  const core = new Float64Array(n);
  const k = Math.max(1, Math.min(minSamples, Math.max(1, n - 1)));

  for (let i = 0; i < n; i++) {
    if (i > 0 && i % yieldEvery === 0) await yieldEventLoop();
    const pi = points[i];
    if (!pi) {
      core[i] = 2;
      continue;
    }
    const dists: number[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const pj = points[j];
      if (!pj) continue;
      dists.push(cosineDistance(pi.embedding, pj.embedding));
    }
    if (dists.length === 0) {
      core[i] = 2;
      continue;
    }
    const sorted = dists.toSorted((a, b) => a - b);
    core[i] = sorted[Math.min(k - 1, sorted.length - 1)] ?? 2;
  }
  return core;
}

async function buildMutualReachabilityMst(
  points: readonly DbscanPoint[],
  coreDist: Float64Array,
  yieldEvery: number,
): Promise<MstEdge[]> {
  const n = points.length;
  if (n < 2) return [];

  const inTree = new Uint8Array(n);
  const bestDist = new Float64Array(n);
  const bestParent = new Int32Array(n);
  bestDist.fill(Number.POSITIVE_INFINITY);
  bestParent.fill(-1);

  inTree[0] = 1;
  const p0 = points[0];
  if (!p0) return [];
  for (let j = 1; j < n; j++) {
    const pj = points[j];
    if (!pj) continue;
    const d = cosineDistance(p0.embedding, pj.embedding);
    bestDist[j] = Math.max(coreDist[0] ?? 0, coreDist[j] ?? 0, d);
    bestParent[j] = 0;
  }

  const edges: MstEdge[] = [];
  let processed = 0;
  for (let added = 1; added < n; added++) {
    processed += 1;
    if (processed % yieldEvery === 0) await yieldEventLoop();

    let best = -1;
    let bestW = Number.POSITIVE_INFINITY;
    for (let i = 0; i < n; i++) {
      if (inTree[i]) continue;
      const w = bestDist[i] ?? Number.POSITIVE_INFINITY;
      if (w < bestW) {
        bestW = w;
        best = i;
      }
    }
    if (best < 0) break;

    inTree[best] = 1;
    const parentIdx = bestParent[best] ?? -1;
    if (parentIdx >= 0) edges.push({ a: parentIdx, b: best, weight: bestW });

    const pb = points[best];
    if (!pb) continue;
    for (let j = 0; j < n; j++) {
      if (inTree[j]) continue;
      const pj = points[j];
      if (!pj) continue;
      const d = cosineDistance(pb.embedding, pj.embedding);
      const mr = Math.max(coreDist[best] ?? 0, coreDist[j] ?? 0, d);
      if (mr < (bestDist[j] ?? Number.POSITIVE_INFINITY)) {
        bestDist[j] = mr;
        bestParent[j] = best;
      }
    }
  }
  return edges;
}

/**
 * 从长到短切边：默认仅真分裂（两侧皆 ≥ min）；
 * peelSmall 时额外剥落小侧（不事后挂靠）。
 */
function flatClustersByViableCuts(
  n: number,
  edges: MstEdge[],
  minClusterSize: number,
  peelSmall: boolean,
): { labels: Int32Array; clusterCount: number; noiseCount: number } {
  const labels = new Int32Array(n);
  labels.fill(-1);
  if (n < minClusterSize) return { labels, clusterCount: 0, noiseCount: n };
  if (edges.length === 0) return { labels, clusterCount: 0, noiseCount: n };

  const parent = new Int32Array(n);
  const sizeArr = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    parent[i] = i;
    sizeArr[i] = 1;
  }
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) {
      const p = parent[r];
      if (p === undefined) break;
      r = p;
    }
    let c = x;
    while (c !== r) {
      const next = parent[c];
      if (next === undefined) break;
      parent[c] = r;
      c = next;
    }
    return r;
  };
  const unite = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    parent[rb] = ra;
    const sa = sizeArr[ra] ?? 0;
    const sb = sizeArr[rb] ?? 0;
    sizeArr[ra] = sa + sb;
  };

  const adj: Array<Array<{ to: number; w: number; id: number }>> = Array.from(
    { length: n },
    () => [],
  );
  edges.forEach((e, id) => {
    const left = adj[e.a];
    const right = adj[e.b];
    if (left) left.push({ to: e.b, w: e.weight, id });
    if (right) right.push({ to: e.a, w: e.weight, id });
  });
  const removed = new Uint8Array(edges.length);

  const componentSizeFrom = (start: number, blockedEdgeId: number): number => {
    const seen = new Uint8Array(n);
    const stack = [start];
    seen[start] = 1;
    let count = 0;
    while (stack.length > 0) {
      const u = stack.pop();
      if (u === undefined) break;
      count += 1;
      const neighbors = adj[u] ?? [];
      for (const link of neighbors) {
        if (removed[link.id] || link.id === blockedEdgeId) continue;
        if (seen[link.to]) continue;
        seen[link.to] = 1;
        stack.push(link.to);
      }
    }
    return count;
  };

  const sortedDesc = edges.map((e, id) => ({ ...e, id })).toSorted((a, b) => b.weight - a.weight);

  for (const e of sortedDesc) {
    if (removed[e.id]) continue;
    const sizeA = componentSizeFrom(e.a, e.id);
    const sizeB = componentSizeFrom(e.b, e.id);
    const aOk = sizeA >= minClusterSize;
    const bOk = sizeB >= minClusterSize;
    if (aOk && bOk) {
      removed[e.id] = 1;
    } else if (peelSmall && aOk !== bOk) {
      removed[e.id] = 1;
    }
  }

  for (let i = 0; i < n; i++) {
    parent[i] = i;
    sizeArr[i] = 1;
  }
  for (let id = 0; id < edges.length; id++) {
    if (removed[id]) continue;
    const e = edges[id];
    if (!e) continue;
    unite(e.a, e.b);
  }

  const rootLabel = new Map<number, number>();
  let clusterCount = 0;
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if ((sizeArr[r] ?? 0) < minClusterSize) continue;
    let lab = rootLabel.get(r);
    if (lab === undefined) {
      lab = clusterCount;
      clusterCount += 1;
      rootLabel.set(r, lab);
    }
    labels[i] = lab;
  }

  let noiseCount = 0;
  for (let i = 0; i < n; i++) {
    if ((labels[i] ?? -1) < 0) noiseCount += 1;
  }

  if (clusterCount === 0 && n >= minClusterSize) {
    for (let i = 0; i < n; i++) labels[i] = 0;
    return { labels, clusterCount: 1, noiseCount: 0 };
  }

  return { labels, clusterCount, noiseCount };
}

export async function runHdbscan(
  points: readonly DbscanPoint[],
  opts: HdbscanOptions,
): Promise<DbscanResult> {
  const minClusterSize = Math.max(2, opts.minClusterSize);
  const minSamples = Math.max(1, opts.minSamples ?? Math.max(1, minClusterSize - 1));
  const peelSmall = opts.peelSmall === true;
  const yieldEvery = opts.yieldEvery ?? 64;
  const n = points.length;

  if (n === 0) return { labels: new Map(), clusterCount: 0, noiseCount: 0 };
  if (n < minClusterSize) {
    const labels = new Map<number, number>();
    for (const p of points) labels.set(p.id, -1);
    return { labels, clusterCount: 0, noiseCount: n };
  }

  const coreDist = await computeCoreDistances(points, minSamples, yieldEvery);
  const mst = await buildMutualReachabilityMst(points, coreDist, yieldEvery);
  const extracted = flatClustersByViableCuts(n, mst, minClusterSize, peelSmall);

  const labels = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const p = points[i];
    if (!p) continue;
    const lab = extracted.labels[i] ?? -1;
    labels.set(p.id, lab < 0 ? -1 : lab);
  }
  return {
    labels,
    clusterCount: extracted.clusterCount,
    noiseCount: extracted.noiseCount,
  };
}
