import { enqueueEmbedding } from "./batch-queue.ts";

/** 异步写入 semantic_memory embedding（失败仅记日志） */
export function scheduleSemanticMemoryEmbedding(id: string, content: string): void {
  enqueueEmbedding({ kind: "semantic_memory", id, content });
}

/** 异步写入 messages embedding（失败仅记日志） */
export function scheduleMessageEmbedding(id: string, content: string): void {
  enqueueEmbedding({ kind: "message", id, content });
}
