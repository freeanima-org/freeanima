import { logPgComponent } from "../log.ts";
import { getActiveRuntimeConfig, getResolvedEmbeddingConfig } from "@freeanima/core/config";

import { expandJobsToUnits } from "./batch-pack.ts";
import { getEmbedTextFn, getEmbedTextsFn } from "./runtime.ts";
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
  const first = vectors[0];
  if (!first) return null;
  const dim = first.length;
  if (!dim) return null;

  const sum = Array.from({ length: dim }, () => 0);
  for (const vec of vectors) {
    if (vec.length !== dim) continue;
    for (let i = 0; i < dim; i++) {
      const vecVal = vec[i];
      if (vecVal === undefined) continue;
      sum[i] = (sum[i] ?? 0) + vecVal;
    }
  }

  const n = vectors.length;
  const avg = sum.map((v) => v / n);
  const norm = Math.sqrt(avg.reduce((acc, v) => acc + v * v, 0));
  if (norm <= 0) return avg;
  return avg.map((v) => v / norm);
}

async function embedUnits(units: EmbeddingEmbedUnit[]): Promise<(number[] | null)[]> {
  if (units.length === 0) return [];
  const embedBatch = getEmbedTextsFn();
  if (embedBatch) {
    try {
      return await embedBatch(units.map((u) => u.text));
    } catch (err) {
      log.warn("embedding batch request failed; falling back to single", {
        unit_count: units.length,
        error: String(err),
      });
    }
  }

  const embedSingle = getEmbedTextFn();
  if (!embedSingle) return units.map(() => null);

  const out: (number[] | null)[] = [];
  for (const unit of units) {
    try {
      out.push(await embedSingle(unit.text));
    } catch (err) {
      log.warn("embedding request failed", {
        kind: unit.job.kind,
        id: unit.job.id,
        chunk_index: unit.chunkIndex,
        error: String(err),
      });
      out.push(null);
    }
  }
  return out;
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

  if (!getEmbedTextFn() && !getEmbedTextsFn()) return 0;

  const validJobs: EmbeddingPendingJob[] = [];
  for (const job of jobs) {
    const trimmed = job.content.trim();
    if (!trimmed) continue;
    validJobs.push({ ...job, content: trimmed });
  }
  if (validJobs.length === 0) return 0;

  const embeddingModel = getResolvedEmbeddingConfig(getActiveRuntimeConfig().data)?.model ?? "";
  const units = expandJobsToUnits(validJobs, { model: embeddingModel });
  const vectors = await embedUnits(units);

  const byJobKey = new Map<string, { job: EmbeddingPendingJob; vectors: number[][] }>();
  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    const vec = vectors[i];
    if (!unit || !vec) continue;
    const key = `${unit.job.kind}:${unit.job.id}`;
    const entry = byJobKey.get(key) ?? { job: unit.job, vectors: [] };
    entry.vectors.push(vec);
    byJobKey.set(key, entry);
  }

  let updated = 0;
  for (const entry of byJobKey.values()) {
    const merged = averageEmbeddings(entry.vectors);
    if (!merged) continue;
    const ok = await storeJobEmbedding(entry.job, merged);
    if (ok) {
      updated += 1;
    } else {
      log.warn("embedding store skipped", { kind: entry.job.kind, id: entry.job.id });
    }
  }

  if (updated > 0) {
    opts?.onStored?.(updated);
  }

  return updated;
}
