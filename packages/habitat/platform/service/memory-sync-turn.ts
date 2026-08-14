import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import type { StoredMessage } from "@freeanima/habitat/core/db/domain";

import { createEmbeddedMemoryService } from "@freeanima/habitat/capabilities/memory/service";

/** 回合结束后 fire-and-forget：cite + 异步 retain（#16102，与 sleep 并行） */
export function scheduleMemorySyncAfterTurn(
  conversationId: string,
  msgs: readonly StoredMessage[],
): void {
  const texts = msgs
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .filter((t) => t.trim().length > 0);

  // StoredMessage 通常无 PG message id；cite 仍可用正文；retain 无 ids 时仅前进空窗/引擎空跑
  const message_ids: string[] = [];

  void createEmbeddedMemoryService()
    .syncTurn({
      conversation_id: conversationId,
      message_ids,
      texts,
      trigger_retain: true,
    })
    .catch((err: unknown) => {
      logComponent("memory").warn("memory syncTurn after turn failed", {
        conversation_id: conversationId,
        err: String(err instanceof Error ? err.message : err),
      });
    });
}
