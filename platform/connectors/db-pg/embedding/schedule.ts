import { logComponent } from "@freeanima/platform/logging";

import { embedAndStoreJobs } from "./embed-jobs.ts";
import type { EmbeddingPendingJob } from "./types.ts";

const log = logComponent("embedding");

const inFlight = new Set<Promise<void>>();

function runEmbedding(job: EmbeddingPendingJob): void {
  const trimmed = job.content.trim();
  if (!trimmed) return;

  const promise: Promise<void> = embedAndStoreJobs([{ ...job, content: trimmed }])
    .then(() => undefined)
    .catch((err) => {
      log.warn("embedding write failed", {
        kind: job.kind,
        id: job.id,
        error: String(err),
      });
    });
  inFlight.add(promise);
  void promise.finally(() => {
    inFlight.delete(promise);
  });
}

/** Async write semantic_memory embedding (failure logged only) */
export function scheduleSemanticMemoryEmbedding(id: string, content: string): void {
  runEmbedding({ kind: "semantic_memory", id, content });
}

/** Async write messages embedding (failure logged only) */
export function scheduleMessageEmbedding(id: string, content: string): void {
  runEmbedding({ kind: "message", id, content });
}

/** Async write limbic_memory embedding (failure logged only) */
export function scheduleLimbicMemoryEmbedding(id: string, content: string): void {
  runEmbedding({ kind: "limbic_memory", id, content });
}

/** Async write autobiographical_memory embedding (failure logged only) */
export function scheduleAutobiographicalMemoryEmbedding(id: string, content: string): void {
  runEmbedding({ kind: "autobiographical_memory", id, content });
}

/** Unit/integration test: await all in-flight embedding writes */
export async function awaitPendingEmbeddingsForTest(): Promise<void> {
  await Promise.all([...inFlight]);
}

/** Test teardown */
export function resetPendingEmbeddingsForTest(): void {
  inFlight.clear();
}
