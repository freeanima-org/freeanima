import { logComponent } from "@freeanima/service-logging";

import {
  DEFAULT_MAX_BATCH_ITEMS,
  DEFAULT_MAX_BATCH_TOKENS,
  packEmbeddingJobs,
} from "./batch-pack.ts";
import { getEmbedTextFn, getEmbedTextsFn } from "./runtime.ts";
import { setMessageEmbedding, setSemanticMemoryEmbedding } from "./store.ts";
import type { EmbeddingPendingJob } from "./types.ts";

const log = logComponent("embedding");

export type EmbedAndStoreJobsOpts = {
  onStored?: (count: number) => void;
};

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

  const packs = packEmbeddingJobs(validJobs, {
    maxItems: DEFAULT_MAX_BATCH_ITEMS,
    maxTokens: DEFAULT_MAX_BATCH_TOKENS,
  });

  let updated = 0;
  for (const pack of packs) {
    const texts = pack.map((job) => job.content);
    let vectors: (number[] | null)[];
    try {
      vectors = await embedTexts(texts);
    } catch (err) {
      log.warn("embedding batch request failed", { count: pack.length, error: String(err) });
      continue;
    }

    const storePromises: Promise<boolean>[] = [];
    for (let i = 0; i < pack.length; i++) {
      const job = pack[i]!;
      const vec = vectors[i];
      if (!vec) continue;
      if (job.kind === "semantic_memory") {
        storePromises.push(setSemanticMemoryEmbedding(job.id, job.content, vec));
      } else {
        storePromises.push(setMessageEmbedding(job.id, job.content, vec));
      }
    }

    const results = await Promise.all(storePromises);
    const stored = results.filter(Boolean).length;
    updated += stored;
    if (stored > 0) {
      opts?.onStored?.(stored);
    }
  }

  return updated;
}
