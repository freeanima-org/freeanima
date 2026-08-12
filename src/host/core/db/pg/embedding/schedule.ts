import { logPgComponent } from "../log.ts";

import { EMBEDDING_QUEUE_FLUSH_THRESHOLD } from "./batch-pack.ts";
import { embedAndStoreJobs } from "./embed-jobs.ts";
import type { EmbeddingPendingJob } from "./types.ts";
import { cstDaySourceRef, notifySoftFailure } from "@freeanima/host/core/soft-failure";

const log = logPgComponent("embedding");

const pendingJobs: EmbeddingPendingJob[] = [];
const inFlight = new Set<Promise<void>>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_DEBOUNCE_MS = 50;

function enqueue(job: EmbeddingPendingJob): void {
  const trimmed = job.content.trim();
  if (!trimmed) return;
  pendingJobs.push({ ...job, content: trimmed });
  if (pendingJobs.length >= EMBEDDING_QUEUE_FLUSH_THRESHOLD) {
    flushPending();
    return;
  }
  if (flushTimer == null) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushPending();
    }, FLUSH_DEBOUNCE_MS);
  }
}

function flushPending(): void {
  if (flushTimer != null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pendingJobs.length === 0) return;
  const batch = pendingJobs.splice(0, pendingJobs.length);
  const promise: Promise<void> = embedAndStoreJobs(batch)
    .then(() => {})
    .catch((err) => {
      const error = String(err);
      log.warn("embedding write failed", {
        batch_size: batch.length,
        error,
      });
      void notifySoftFailure({
        sourceRef: cstDaySourceRef("embedding:write_failed"),
        title: "向量写入失败",
        body: [
          "异步 embedding 写入失败（已记录日志并旁路继续）。向量检索可能暂时空洞。",
          `batch_size=${batch.length}`,
          `错误：${error}`,
        ].join("\n"),
        payload: { kind: "embedding_write_failed", batch_size: batch.length, error },
        logLabel: "embedding",
      });
    });
  inFlight.add(promise);
  void promise.finally(() => {
    inFlight.delete(promise);
  });
}

/** Async write semantic_memory entity embedding (failure logged only) */
export function scheduleSemanticMemoryEmbedding(id: string | number, content: string): void {
  scheduleEntityEmbedding(Number(id), content);
}

/** Async write messages embedding (failure logged only) */
export function scheduleMessageEmbedding(id: string, content: string): void {
  enqueue({ kind: "message", id, content });
}

/** Async write limbic_memory embedding (failure logged only) */
export function scheduleLimbicMemoryEmbedding(id: string, content: string): void {
  enqueue({ kind: "limbic_memory", id, content });
}

/** Async write autobiographical_memory embedding (failure logged only) */
export function scheduleAutobiographicalMemoryEmbedding(id: string, content: string): void {
  enqueue({ kind: "autobiographical_memory", id, content });
}

/** Async write entity search embedding (failure logged only) */
export function scheduleEntityEmbedding(id: number, content: string): void {
  enqueue({ kind: "entity", id: String(id), content });
}

/** Unit/integration test: await all in-flight embedding writes */
export async function awaitPendingEmbeddingsForTest(): Promise<void> {
  flushPending();
  await Promise.all(inFlight);
}

/** Test teardown */
export function resetPendingEmbeddingsForTest(): void {
  if (flushTimer != null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  pendingJobs.length = 0;
  inFlight.clear();
}
