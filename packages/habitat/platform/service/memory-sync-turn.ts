import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import type { StoredMessage } from "@freeanima/habitat/core/db/domain";
import { listMessageRowsPage } from "@freeanima/habitat/core/db/pg/conversation";

import {
  createEmbeddedMemoryService,
  getRetainWatermark,
} from "@freeanima/habitat/capabilities/memory/service";

/** 取本会话 user/assistant 的 PG message_id；优先仅 watermark 之后的新消息。 */
export async function resolveSyncTurnMessageIds(conversationId: string): Promise<string[]> {
  const rows = await listMessageRowsPage(conversationId, 0, 5000);
  const ids = rows
    .filter((r) => r.role === "user" || r.role === "assistant")
    .map((r) => r.message_id)
    .filter(Boolean);
  if (ids.length === 0) return [];

  const wm = await getRetainWatermark(conversationId);
  if (!wm?.message_id) return ids;

  const idx = ids.indexOf(wm.message_id);
  if (idx < 0) return ids;

  const newer = ids.slice(idx + 1);
  // 无新消息时仍传 tip，retain 可 watermark skip
  const tip = ids[ids.length - 1];
  return newer.length > 0 ? newer : tip ? [tip] : [];
}

/** 回合结束后 fire-and-forget：cite + 异步 retain（#16102） */
export function scheduleMemorySyncAfterTurn(
  conversationId: string,
  msgs: readonly StoredMessage[],
): void {
  const texts = msgs
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .filter((t) => t.trim().length > 0);

  void (async () => {
    let message_ids: string[] = [];
    try {
      message_ids = await resolveSyncTurnMessageIds(conversationId);
    } catch (err: unknown) {
      logComponent("memory").warn("resolve syncTurn message_ids failed; cite-only path", {
        conversation_id: conversationId,
        err: String(err instanceof Error ? err.message : err),
      });
    }

    await createEmbeddedMemoryService().syncTurn({
      conversation_id: conversationId,
      message_ids,
      texts,
      trigger_retain: true,
    });
  })().catch((err: unknown) => {
    logComponent("memory").warn("memory syncTurn after turn failed", {
      conversation_id: conversationId,
      err: String(err instanceof Error ? err.message : err),
    });
  });
}
