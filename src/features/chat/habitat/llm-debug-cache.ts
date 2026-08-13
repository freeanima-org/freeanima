import { cacheGetJson, cacheSetJson, REDIS_CACHE_KEY_PREFIX } from "@freeanima/host/core/redis";
import type { LlmDebugSnapshotPayload } from "@freeanima/shared/rpc-contract/frames/message";
import { coerceString } from "@freeanima/shared/coerce-string";

/** 滚动覆盖：每次写入重置 TTL */
export const LLM_DEBUG_CACHE_TTL_SECONDS = 600;

export type LlmDebugCacheEntry = {
  initial?: LlmDebugSnapshotPayload;
  final?: LlmDebugSnapshotPayload;
  updated_at: string;
};

export function llmDebugCacheKey(conversationId: string): string {
  return `${REDIS_CACHE_KEY_PREFIX}llm-debug:${conversationId}`;
}

function asSnapshot(payload: Record<string, unknown>): LlmDebugSnapshotPayload | null {
  const phase = payload.phase;
  if (phase !== "initial" && phase !== "final") return null;
  const invoke = payload.invoke;
  if (!invoke || typeof invoke !== "object") return null;
  const snapshot: LlmDebugSnapshotPayload = {
    phase,
    turn_index: Number(payload.turn_index ?? 0),
    model: coerceString(payload.model),
    tool_count: Number(payload.tool_count ?? 0),
    tools: Array.isArray(payload.tools) ? (payload.tools as LlmDebugSnapshotPayload["tools"]) : [],
    invoke: invoke as LlmDebugSnapshotPayload["invoke"],
  };
  const injections = payload.runtime_injections;
  if (injections && typeof injections === "object") {
    snapshot.runtime_injections = injections;
  }
  const passive = payload.passive_recall;
  if (passive && typeof passive === "object") {
    snapshot.passive_recall = passive as NonNullable<LlmDebugSnapshotPayload["passive_recall"]>;
  }
  return snapshot;
}

/** 将 stream.llm_debug payload（可含 stream_id）合并写入 Redis，TTL 滚动刷新 */
export async function rememberLlmDebugFromStreamPayload(
  conversationId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const snapshot = asSnapshot(payload);
  if (!snapshot) return;

  const key = llmDebugCacheKey(conversationId);
  const prev = (await cacheGetJson<LlmDebugCacheEntry>(key)) ?? {};
  const next: LlmDebugCacheEntry = {
    ...prev,
    updated_at: new Date().toISOString(),
  };
  if (snapshot.phase === "initial") next.initial = snapshot;
  else next.final = snapshot;
  await cacheSetJson(key, next, LLM_DEBUG_CACHE_TTL_SECONDS);
}

export async function loadLlmDebugCache(
  conversationId: string,
): Promise<LlmDebugCacheEntry | null> {
  return cacheGetJson<LlmDebugCacheEntry>(llmDebugCacheKey(conversationId));
}
