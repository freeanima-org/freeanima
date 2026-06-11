import { logComponent } from "@freeanima/service-logging";
import { getResolvedEmbeddingConfig } from "@freeanima/service-config";

import { packEmbeddingJobs } from "./batch-pack.ts";
import { getEmbedTextFn, getEmbedTextsFn } from "./runtime.ts";
import { setMessageEmbedding, setSemanticMemoryEmbedding } from "./store.ts";
import type { EmbeddingEmbedUnit, EmbeddingPendingJob } from "./types.ts";

const log = logComponent("embedding");

export type EmbedAndStoreJobsOpts = {
  onStored?: (count: number) => void;
};

function jobStoreKey(unit: EmbeddingEmbedUnit): string {
  return `${unit.job.kind}:${unit.job.id}`;
}

/** L2-normalized mean of chunk vectors (single vector when only one chunk). */
export function averageEmbeddings(vectors: number[][]): number[] | null {
  if (!vectors.length) return null;
  const dim = vectors[0]!.length;
  if (!dim) return null;

  const sum = Array.from({ length: dim }, () => 0);
  for (const vec of vectors) {
    if (vec.length !== dim) continue;
    for (let i = 0; i < dim; i++) {
      sum[i]! += vec[i]!;
    }
  }

  const n = vectors.length;
  const avg = sum.map((v) => v / n);
  const norm = Math.sqrt(avg.reduce((acc, v) => acc + v * v, 0));
  if (norm <= 0) return avg;
  return avg.map((v) => v / norm);
}

async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  const embedBatch = getEmbedTextsFn();
  if (embedBatch) {
    return embedBatch(texts);
  }

  const embedSingle = getEmbedTextFn();
  if (!embedSingle) {
    return texts.map(() => null);
  }

  const vectors: (number[] | null)[] = [];
  for (const text of texts) {
    vectors.push(await embedSingle(text));
  }
  return vectors;
}

async function embedPackWithFallback(units: EmbeddingEmbedUnit[]): Promise<(number[] | null)[]> {
  const texts = units.map((u) => u.text);
  try {
    return await embedTexts(texts);
  } catch (err) {
    log.warn("embedding batch request failed, retrying one-by-one", {
      count: units.length,
      error: String(err),
    });
  }

  const vectors: (number[] | null)[] = [];
  for (const unit of units) {
    try {
      const [vec] = await embedTexts([unit.text]);
      vectors.push(vec ?? null);
    } catch (singleErr) {
      log.warn("embedding single request failed", {
        kind: unit.job.kind,
        id: unit.job.id,
        chunk_index: unit.chunkIndex,
        error: String(singleErr),
      });
      vectors.push(null);
    }
  }
  return vectors;
}

export async function embedAndStoreJobs(
  jobs: EmbeddingPendingJob[],
  opts?: EmbedAndStoreJobsOpts,
): Promise<number> {
  if (!jobs.length) return 0;

  const embedBatch = getEmbedTextsFn();
  const embedSingle = getEmbedTextFn();
  if (!embedBatch && !embedSingle) return 0;

  const validJobs: EmbeddingPendingJob[] = [];
  for (const job of jobs) {
    const trimmed = job.content.trim();
    if (!trimmed) continue;
    validJobs.push({ ...job, content: trimmed });
  }
  if (!validJobs.length) return 0;

  const embeddingModel = getResolvedEmbeddingConfig()?.model ?? "";
  const packs = packEmbeddingJobs(validJobs, { model: embeddingModel });

  const vectorsByJob = new Map<string, number[][]>();

  for (const pack of packs) {
    const vectors = await embedPackWithFallback(pack);
    for (let i = 0; i < pack.length; i++) {
      const unit = pack[i]!;
      const vec = vectors[i];
      if (!vec) continue;
      const key = jobStoreKey(unit);
      const list = vectorsByJob.get(key) ?? [];
      list.push(vec);
      vectorsByJob.set(key, list);
    }
  }

  let updated = 0;
  const storePromises: Promise<boolean>[] = [];

  for (const [, unitList] of groupUnitsByJob(packs)) {
    const unit = unitList[0]!;
    const key = jobStoreKey(unit);
    const chunkVectors = vectorsByJob.get(key);
    if (!chunkVectors?.length) continue;

    const merged = averageEmbeddings(chunkVectors);
    if (!merged) continue;

    if (unit.job.kind === "semantic_memory") {
      storePromises.push(setSemanticMemoryEmbedding(unit.job.id, unit.job.content, merged));
    } else {
      storePromises.push(setMessageEmbedding(unit.job.id, unit.job.content, merged));
    }
  }

  const results = await Promise.all(storePromises);
  updated = results.filter(Boolean).length;
  if (updated > 0) {
    opts?.onStored?.(updated);
  }

  return updated;
}

function groupUnitsByJob(packs: EmbeddingEmbedUnit[][]): Map<string, EmbeddingEmbedUnit[]> {
  const grouped = new Map<string, EmbeddingEmbedUnit[]>();
  for (const pack of packs) {
    for (const unit of pack) {
      const key = jobStoreKey(unit);
      const list = grouped.get(key) ?? [];
      if (!list.length) list.push(unit);
      grouped.set(key, list);
    }
  }
  return grouped;
}
