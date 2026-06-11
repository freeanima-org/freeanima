import { countTokens, splitTextByTokenLimit } from "@freeanima/engine-tokenizer";
import { logComponent } from "@freeanima/service-logging";

import type { EmbeddingEmbedUnit, EmbeddingPendingJob } from "./types.ts";

const log = logComponent("embedding");

/** Hard per-input limit; default matches Ollama runtime num_ctx (4096). Card may list 8192 — set Modelfile `num_ctx 8192` to use full bge-m3 window. */
export const MAX_CHUNK_TOKENS = 4096;
/** Pack / split / alone threshold: half of max chunk (headroom for tokenizer vs Ollama mismatch). */
export const TARGET_BATCH_TOKENS = Math.floor(MAX_CHUNK_TOKENS * 0.5);
/** Above this token count a unit is embedded alone (not packed with others). */
export const SINGLE_ALONE_THRESHOLD_TOKENS = TARGET_BATCH_TOKENS;

/** Debounced queue flush when pending job count reaches this (not API batch size). */
export const EMBEDDING_QUEUE_FLUSH_THRESHOLD = 64;

/** @deprecated Use TARGET_BATCH_TOKENS / MAX_CHUNK_TOKENS. */
export const MAX_SINGLE_EMBEDDING_TOKENS = MAX_CHUNK_TOKENS;
/** @deprecated Use TARGET_BATCH_TOKENS. */
export const DEFAULT_MAX_BATCH_TOKENS = TARGET_BATCH_TOKENS;
/** @deprecated Use EMBEDDING_QUEUE_FLUSH_THRESHOLD. */
export const DEFAULT_MAX_BATCH_ITEMS = EMBEDDING_QUEUE_FLUSH_THRESHOLD;

export type PackEmbeddingJobsOpts = {
  model: string;
  targetBatchTokens?: number;
  maxChunkTokens?: number;
  singleAloneThreshold?: number;
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

function unitTokens(unit: EmbeddingEmbedUnit, model: string): number {
  return countTokens(unit.text, model);
}

/**
 * Pack embed units into API batches:
 * - fill each batch up to ~50% of max chunk tokens;
 * - above that threshold each unit is embedded alone;
 * - longer inputs are pre-split at the same 50% budget.
 */
export function packEmbeddingJobs(
  jobs: EmbeddingPendingJob[],
  opts: PackEmbeddingJobsOpts,
): EmbeddingEmbedUnit[][] {
  const model = opts.model;
  const targetBatch = opts.targetBatchTokens ?? TARGET_BATCH_TOKENS;
  const maxChunk = opts.maxChunkTokens ?? MAX_CHUNK_TOKENS;
  const aloneThreshold = opts.singleAloneThreshold ?? SINGLE_ALONE_THRESHOLD_TOKENS;

  const units = jobs.flatMap((job) => expandJobToUnits(job, maxChunk, model));
  if (!units.length) return [];

  const packs: EmbeddingEmbedUnit[][] = [];
  let current: EmbeddingEmbedUnit[] = [];
  let currentTokens = 0;

  for (const unit of units) {
    const tokens = unitTokens(unit, model);

    if (tokens > maxChunk) {
      log.warn("embedding chunk still exceeds model limit, skipping", {
        kind: unit.job.kind,
        id: unit.job.id,
        chunk_index: unit.chunkIndex,
        tokens,
      });
      continue;
    }

    if (tokens > aloneThreshold) {
      if (current.length > 0) {
        packs.push(current);
        current = [];
        currentTokens = 0;
      }
      packs.push([unit]);
      continue;
    }

    if (current.length > 0 && currentTokens + tokens > targetBatch) {
      packs.push(current);
      current = [];
      currentTokens = 0;
    }

    current.push(unit);
    currentTokens += tokens;
  }

  if (current.length > 0) {
    packs.push(current);
  }

  return packs;
}
