import { logComponent } from "@freeanima/service-logging";

import type { EmbeddingPendingJob } from "./types.ts";

const log = logComponent("embedding");

export const MAX_SINGLE_EMBEDDING_TOKENS = 8192;
export const DEFAULT_MAX_BATCH_TOKENS = 7500;
export const DEFAULT_MAX_BATCH_ITEMS = 64;

/** Rough token estimate (~3.5 chars/token for mixed CJK/Latin) */
export function estimateEmbeddingTokens(text: string): number {
  const len = text.trim().length;
  if (!len) return 0;
  return Math.max(1, Math.ceil(len / 3.5));
}

export type PackEmbeddingJobsOpts = {
  maxItems?: number;
  maxTokens?: number;
};

export function packEmbeddingJobs(
  jobs: EmbeddingPendingJob[],
  opts?: PackEmbeddingJobsOpts,
): EmbeddingPendingJob[][] {
  const maxItems = opts?.maxItems ?? DEFAULT_MAX_BATCH_ITEMS;
  const maxTokens = opts?.maxTokens ?? DEFAULT_MAX_BATCH_TOKENS;

  const packs: EmbeddingPendingJob[][] = [];
  let current: EmbeddingPendingJob[] = [];
  let currentTokens = 0;

  for (const job of jobs) {
    const tokens = estimateEmbeddingTokens(job.content);
    if (tokens > MAX_SINGLE_EMBEDDING_TOKENS) {
      log.warn("single embedding exceeds token limit, skipping", {
        kind: job.kind,
        id: job.id,
        tokens,
      });
      continue;
    }

    if (current.length > 0 && (current.length >= maxItems || currentTokens + tokens > maxTokens)) {
      packs.push(current);
      current = [];
      currentTokens = 0;
    }

    current.push(job);
    currentTokens += tokens;
  }

  if (current.length > 0) {
    packs.push(current);
  }

  return packs;
}
