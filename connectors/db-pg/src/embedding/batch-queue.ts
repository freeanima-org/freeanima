import { logComponent } from "@freeanima/service-logging";

import { embedAndStoreJobs } from "./embed-jobs.ts";
import { DEFAULT_MAX_BATCH_ITEMS } from "./batch-pack.ts";
import type { EmbeddingPendingJob } from "./types.ts";

const log = logComponent("embedding");

const FLUSH_DELAY_MS = 300;

let pending = new Map<string, EmbeddingPendingJob>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushPromise: Promise<void> | null = null;

function jobKey(job: EmbeddingPendingJob): string {
  return `${job.kind}:${job.id}`;
}

function clearFlushTimer(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void drainQueue();
  }, FLUSH_DELAY_MS);
}

async function drainQueue(): Promise<void> {
  if (flushPromise) {
    await flushPromise;
    if (pending.size > 0) {
      return drainQueue();
    }
    return;
  }

  if (!pending.size) return;

  const jobs = [...pending.values()];
  pending.clear();

  flushPromise = (async () => {
    try {
      await embedAndStoreJobs(jobs);
    } catch (err) {
      log.warn("embedding batch write failed", { count: jobs.length, error: String(err) });
    }
  })();

  try {
    await flushPromise;
  } finally {
    flushPromise = null;
  }

  if (pending.size > 0) {
    if (pending.size >= DEFAULT_MAX_BATCH_ITEMS) {
      void drainQueue();
    } else {
      scheduleFlush();
    }
  }
}

/** Enqueue async embedding (debounce merged batch) */
export function enqueueEmbedding(job: EmbeddingPendingJob): void {
  const trimmed = job.content.trim();
  if (!trimmed) return;

  pending.set(jobKey({ ...job, content: trimmed }), { ...job, content: trimmed });

  if (pending.size >= DEFAULT_MAX_BATCH_ITEMS) {
    clearFlushTimer();
    void drainQueue();
    return;
  }

  scheduleFlush();
}

/** Unit/integration test: drain queue immediately */
export async function flushEmbeddingQueueForTest(): Promise<void> {
  clearFlushTimer();
  while (pending.size > 0 || flushPromise) {
    await drainQueue();
  }
}

/** Test teardown */
export function resetEmbeddingQueueForTest(): void {
  clearFlushTimer();
  pending.clear();
  flushPromise = null;
}
