import { enqueueEmbedding } from "./batch-queue.ts";

/** Async write semantic_memory embedding (failure logged only) */
export function scheduleSemanticMemoryEmbedding(id: string, content: string): void {
  enqueueEmbedding({ kind: "semantic_memory", id, content });
}

/** Async write messages embedding (failure logged only) */
export function scheduleMessageEmbedding(id: string, content: string): void {
  enqueueEmbedding({ kind: "message", id, content });
}
