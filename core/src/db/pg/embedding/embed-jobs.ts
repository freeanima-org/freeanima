import { logPgComponent } from "../log.ts";
import { getActiveConfig, getResolvedEmbeddingConfig } from "@freeanima/core/config";

import { expandJobsToUnits } from "./batch-pack.ts";
import { getEmbedTextFn } from "./runtime.ts";
import {
  setAutobiographicalMemoryEmbedding,
  setEntityEmbedding,
  setLimbicMemoryEmbedding,
  setMessageEmbedding,
  setSemanticMemoryEmbedding,
} from "./store.ts";
import type { EmbeddingEmbedUnit, EmbeddingPendingJob } from "./types.ts";

const log = logPgComponent("embedding");

export type EmbedAndStoreJobsOpts = {
  onStored?: (count: number) => void;
};

/** L2-normalized mean of chunk vectors (single vector when only one chunk). */
export function averageEmbeddings(vectors: number[][]): number[] | null {
  if (vectors.length === 0) return null;
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

async function embedUnit(unit: EmbeddingEmbedUnit): Promise<number[] | null> {
  const embedSingle = getEmbedTextFn();
  if (!embedSingle) return null;

  try {
    return await embedSingle(unit.text);
  } catch (err) {
    log.warn("embedding request failed", {
      kind: unit.job.kind,
      id: unit.job.id,
      chunk_index: unit.chunkIndex,
      error: String(err),
    });
    return null;
  }
}

async function storeJobEmbedding(job: EmbeddingPendingJob, merged: number[]): Promise<boolean> {
  switch (job.kind) {
    case "semantic_memory":
      return setSemanticMemoryEmbedding(job.id, job.content, merged);
    case "limbic_memory":
      return setLimbicMemoryEmbedding(job.id, job.content, merged);
    case "autobiographical_memory":
      return setAutobiographicalMemoryEmbedding(job.id, job.content, merged);
    case "message":
      return setMessageEmbedding(job.id, job.content, merged);
    case "entity":
      return setEntityEmbedding(Number(job.id), job.content, merged);
  }
}

export async function embedAndStoreJobs(
  jobs: EmbeddingPendingJob[],
  opts?: EmbedAndStoreJobsOpts,
): Promise<number> {
  if (jobs.length === 0) return 0;

  const embedSingle = getEmbedTextFn();
  if (!embedSingle) return 0;

  const validJobs: EmbeddingPendingJob[] = [];
  for (const job of jobs) {
    const trimmed = job.content.trim();
    if (!trimmed) continue;
    validJobs.push({ ...job, content: trimmed });
  }
  if (validJobs.length === 0) return 0;

  const embeddingModel = getResolvedEmbeddingConfig(getActiveConfig().data)?.model ?? "";
  let updated = 0;

  for (const job of validJobs) {
    const units = expandJobsToUnits([job], { model: embeddingModel });
    const chunkVectors: number[][] = [];
    for (const unit of units) {
      const vec = await embedUnit(unit);
      if (vec) chunkVectors.push(vec);
    }
    if (chunkVectors.length === 0) continue;

    const merged = averageEmbeddings(chunkVectors);
    if (!merged) continue;

    const ok = await storeJobEmbedding(job, merged);
    if (ok) {
      updated += 1;
    } else {
      log.warn("embedding store skipped", { kind: job.kind, id: job.id });
    }
  }

  if (updated > 0) {
    opts?.onStored?.(updated);
  }

  return updated;
}
