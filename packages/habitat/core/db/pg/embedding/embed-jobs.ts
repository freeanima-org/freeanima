import { logPgComponent } from "../log.ts";
import { getActiveRuntimeConfig, getResolvedEmbeddingConfig } from "@freeanima/habitat/core/config";
import { coerceString } from "@freeanima/shared/coerce-string";

import { expandJobsToUnits } from "./batch-pack.ts";
import { getEmbedTextFn, getEmbedTextsFn, getAfterEmbeddingStored } from "./runtime.ts";
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

export type EmbedAndStoreJobsResult = {
  stored: number;
  /** When stored === 0 after attempting work, explains why (API / store / chunking). */
  emptyReason?: string;
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

async function embedUnits(
  units: EmbeddingEmbedUnit[],
): Promise<{ vectors: (number[] | null)[]; failure?: string }> {
  if (units.length === 0) return { vectors: [] };
  const embedBatch = getEmbedTextsFn();
  if (embedBatch) {
    try {
      return { vectors: await embedBatch(units.map((u) => u.text)) };
    } catch (err) {
      const failure = err instanceof Error ? err.message : String(err);
      log.warn("embedding batch request failed; falling back to single", {
        unit_count: units.length,
        error: failure,
      });
    }
  }

  const embedSingle = getEmbedTextFn();
  if (!embedSingle) {
    return { vectors: units.map(() => null), failure: "embedding client not registered" };
  }

  const out: (number[] | null)[] = [];
  let failure: string | undefined;
  for (const unit of units) {
    try {
      const vec = await embedSingle(unit.text);
      if (!vec?.length) {
        failure = "embedding API returned empty vector";
        out.push(null);
        continue;
      }
      out.push(vec);
    } catch (err) {
      failure = err instanceof Error ? err.message : String(err);
      log.warn("embedding request failed", {
        kind: unit.job.kind,
        id: unit.job.id,
        chunk_index: unit.chunkIndex,
        error: failure,
      });
      out.push(null);
    }
  }
  return { vectors: out, ...(failure ? { failure } : {}) };
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
    default: {
      const _exhaustive: never = job.kind;
      throw new Error(`Unhandled embedding job kind: ${coerceString(_exhaustive)}`);
    }
  }
}

export async function embedAndStoreJobsResult(
  jobs: EmbeddingPendingJob[],
  opts?: EmbedAndStoreJobsOpts,
): Promise<EmbedAndStoreJobsResult> {
  if (jobs.length === 0) return { stored: 0, emptyReason: "no jobs" };

  if (!getEmbedTextFn() && !getEmbedTextsFn()) {
    return { stored: 0, emptyReason: "embedding client not registered" };
  }

  const validJobs: EmbeddingPendingJob[] = [];
  for (const job of jobs) {
    const trimmed = job.content.trim();
    if (!trimmed) continue;
    validJobs.push({ ...job, content: trimmed });
  }
  if (validJobs.length === 0) return { stored: 0, emptyReason: "all job contents empty" };

  const embeddingModel = getResolvedEmbeddingConfig(getActiveRuntimeConfig().data)?.model ?? "";
  const units = expandJobsToUnits(validJobs, { model: embeddingModel });
  if (units.length === 0) {
    return {
      stored: 0,
      emptyReason: "no embed units after chunking (text may exceed model limit)",
    };
  }

  const { vectors, failure: embedFailure } = await embedUnits(units);

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
  let storeFailure: string | undefined;
  for (const entry of byJobKey.values()) {
    const merged = averageEmbeddings(entry.vectors);
    if (!merged) continue;
    const ok = await storeJobEmbedding(entry.job, merged);
    if (ok) {
      updated += 1;
      const after = getAfterEmbeddingStored();
      if (after) {
        try {
          await after({ kind: entry.job.kind, id: entry.job.id, embedding: merged });
        } catch (err) {
          log.warn("afterEmbeddingStored failed", {
            kind: entry.job.kind,
            id: entry.job.id,
            error: String(err),
          });
        }
      }
    } else {
      storeFailure = `search_documents missing for ${entry.job.kind}:${entry.job.id}`;
      log.warn("embedding store skipped", { kind: entry.job.kind, id: entry.job.id });
    }
  }

  if (updated > 0) {
    opts?.onStored?.(updated);
    return { stored: updated };
  }

  const emptyReason =
    storeFailure ??
    embedFailure ??
    (byJobKey.size === 0 ? "embedding API returned no usable vectors" : "store updated 0 rows");
  return { stored: 0, emptyReason };
}

export async function embedAndStoreJobs(
  jobs: EmbeddingPendingJob[],
  opts?: EmbedAndStoreJobsOpts,
): Promise<number> {
  const result = await embedAndStoreJobsResult(jobs, opts);
  return result.stored;
}
