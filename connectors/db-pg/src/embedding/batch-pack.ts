import { logComponent } from "@freeanima/service-logging";

import type { EmbeddingEmbedUnit, EmbeddingPendingJob } from "./types.ts";

const log = logComponent("embedding");

/** Target total tokens per embedding API batch. */
export const TARGET_BATCH_TOKENS = 6000;
/** Hard per-input limit (bge-m3 context). */
export const MAX_CHUNK_TOKENS = 8192;
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

/** Rough token estimate (~3.5 chars/token for mixed CJK/Latin). */
export function estimateEmbeddingTokens(text: string): number {
  const len = text.trim().length;
  if (!len) return 0;
  return Math.max(1, Math.ceil(len / 3.5));
}

/** Max character length for a given token budget (inverse of estimateEmbeddingTokens). */
export function maxCharsForTokenBudget(tokens: number): number {
  return Math.floor(tokens * 3.5);
}

/** Split long text into chunks each within maxTokens (by char estimate). */
export function splitTextByTokenLimit(text: string, maxTokens: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const maxChars = maxCharsForTokenBudget(maxTokens);
  if (trimmed.length <= maxChars) return [trimmed];

  const chunks: string[] = [];
  for (let start = 0; start < trimmed.length; start += maxChars) {
    chunks.push(trimmed.slice(start, start + maxChars));
  }
  return chunks;
}

export type PackEmbeddingJobsOpts = {
  targetBatchTokens?: number;
  maxChunkTokens?: number;
  singleAloneThreshold?: number;
};

function expandJobToUnits(job: EmbeddingPendingJob, maxChunkTokens: number): EmbeddingEmbedUnit[] {
  const content = job.content.trim();
  const tokens = estimateEmbeddingTokens(content);

  if (tokens <= maxChunkTokens) {
    return [{ job: { ...job, content }, text: content }];
  }

  const chunks = splitTextByTokenLimit(content, TARGET_BATCH_TOKENS);
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

function unitTokens(unit: EmbeddingEmbedUnit): number {
  return estimateEmbeddingTokens(unit.text);
}

/**
 * Pack embed units into API batches:
 * - fill each batch up to ~6K tokens;
 * - 6K–8K units go alone;
 * - >8K inputs are pre-split into ~6K chunks.
 */
export function packEmbeddingJobs(
  jobs: EmbeddingPendingJob[],
  opts?: PackEmbeddingJobsOpts,
): EmbeddingEmbedUnit[][] {
  const targetBatch = opts?.targetBatchTokens ?? TARGET_BATCH_TOKENS;
  const maxChunk = opts?.maxChunkTokens ?? MAX_CHUNK_TOKENS;
  const aloneThreshold = opts?.singleAloneThreshold ?? SINGLE_ALONE_THRESHOLD_TOKENS;

  const units = jobs.flatMap((job) => expandJobToUnits(job, maxChunk));
  if (!units.length) return [];

  const packs: EmbeddingEmbedUnit[][] = [];
  let current: EmbeddingEmbedUnit[] = [];
  let currentTokens = 0;

  for (const unit of units) {
    const tokens = unitTokens(unit);

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
