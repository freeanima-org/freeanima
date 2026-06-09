import { logComponent } from "@freeanima/service-logging";

import { setMessageEmbedding, setSemanticMemoryEmbedding } from "./store.ts";
import { getEmbedTextFn } from "./runtime.ts";

const log = logComponent("embedding");

async function embedAndStoreSemanticMemory(id: string, content: string): Promise<void> {
  const embed = getEmbedTextFn();
  if (!embed) return;
  const trimmed = content.trim();
  if (!trimmed) return;
  const vec = await embed(trimmed);
  if (!vec) return;
  await setSemanticMemoryEmbedding(id, trimmed, vec);
}

async function embedAndStoreMessage(id: string, content: string): Promise<void> {
  const embed = getEmbedTextFn();
  if (!embed) return;
  const trimmed = content.trim();
  if (!trimmed) return;
  const vec = await embed(trimmed);
  if (!vec) return;
  await setMessageEmbedding(id, trimmed, vec);
}

/** 异步写入 semantic_memory embedding（失败仅记日志） */
export function scheduleSemanticMemoryEmbedding(id: string, content: string): void {
  void embedAndStoreSemanticMemory(id, content).catch((err) => {
    log.warn("semantic_memory embedding 失败", { id, error: String(err) });
  });
}

/** 异步写入 messages embedding（失败仅记日志） */
export function scheduleMessageEmbedding(id: string, content: string): void {
  void embedAndStoreMessage(id, content).catch((err) => {
    log.warn("messages embedding 失败", { id, error: String(err) });
  });
}
