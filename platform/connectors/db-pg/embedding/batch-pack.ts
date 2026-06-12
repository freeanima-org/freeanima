import { countTokens, splitTextByTokenLimit } from "@freeanima/core/tokenizer";
import { logComponent } from "@freeanima/platform/logging";

import type { EmbeddingEmbedUnit, EmbeddingPendingJob } from "./types.ts";

const log = logComponent("embedding");

/** Hard per-input limit; default matches Ollama runtime num_ctx (4096). Card may list 8192 — set Modelfile `num_ctx 8192` to use full bge-m3 window. */
export const MAX_CHUNK_TOKENS = 4096;
/** Long-text split budget: half of max chunk (headroom for tokenizer vs Ollama mismatch). */
export const TARGET_BATCH_TOKENS = Math.floor(MAX_CHUNK_TOKENS * 0.5);

/** PG page size for fts_segmented rebuild only (embedding rebuild uses one row per fetch). */
export const EMBEDDING_QUEUE_FLUSH_THRESHOLD = 64;

/** @deprecated Use TARGET_BATCH_TOKENS / MAX_CHUNK_TOKENS. */
export const MAX_SINGLE_EMBEDDING_TOKENS = MAX_CHUNK_TOKENS;
/** @deprecated Use TARGET_BATCH_TOKENS. */
export const DEFAULT_MAX_BATCH_TOKENS = TARGET_BATCH_TOKENS;
/** @deprecated Use EMBEDDING_QUEUE_FLUSH_THRESHOLD. */
export const DEFAULT_MAX_BATCH_ITEMS = EMBEDDING_QUEUE_FLUSH_THRESHOLD;

export type ExpandEmbeddingJobsOpts = {
  model: string;
  maxChunkTokens?: number;
};

function expandJobToUnits(
  job: EmbeddingPendingJob,
  _maxChunkTokens: number,
  model: string,
): EmbeddingEmbedUnit[] {
  const content = job.content.trim();
  const tokens = countTokens(content, model);
  const splitBudget = TARGET_BATCH_TOKENS;

  if (tokens <= splitBudget) {
    return [{ job: { ...job, content }, text: content }];
  }

  const chunks = splitTextByTokenLimit(content, splitBudget, model);
  log.debug("embedding text split into chunks", {
    kind: job.kind,
    id: job.id,
    tokens,
    chunks: chunks.length,
  });

  return chunks.map((text, chunkIndex) => ({
    job: { ...job, content },
    text,
    chunkIndex,
    chunkCount: chunks.length,
  }));
}

/**
 * Expand jobs into embed units (one API call each):
 * - short texts stay as one unit;
 * - longer inputs are split at TARGET_BATCH_TOKENS.
 */
export function expandJobsToUnits(
  jobs: EmbeddingPendingJob[],
  opts: ExpandEmbeddingJobsOpts,
): EmbeddingEmbedUnit[] {
  const model = opts.model;
  const maxChunk = opts.maxChunkTokens ?? MAX_CHUNK_TOKENS;

  const units = jobs.flatMap((job) => expandJobToUnits(job, maxChunk, model));
  if (!units.length) return [];

  const result: EmbeddingEmbedUnit[] = [];
  for (const unit of units) {
    const tokens = countTokens(unit.text, model);
    if (tokens > maxChunk) {
      log.warn("embedding chunk still exceeds model limit, skipping", {
        kind: unit.job.kind,
        id: unit.job.id,
        chunk_index: unit.chunkIndex,
        tokens,
      });
      continue;
    }
    result.push(unit);
  }

  return result;
}
