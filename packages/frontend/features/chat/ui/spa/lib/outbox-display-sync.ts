import type { DisplayItem } from "@freeanima/features/chat/ui/spa/lib/types.ts";
import type { ChatOutboxEntry } from "@freeanima/features/chat/ui/spa/lib/offline-send-store.ts";

/** 服务端 display 中是否已有同内容的 user 消息（无 clientOpId，即已落库） */
export function hasServerUserMessage(display: DisplayItem[], text: string): boolean {
  return display.some(
    (item) =>
      item.type === "message" && item.role === "user" && item.content === text && !item.clientOpId,
  );
}

/** 服务端 display 中是否已有该 user 文本且其后已有 assistant 回复 */
export function isOutboxDeliveredOnDisplay(display: DisplayItem[], text: string): boolean {
  for (let i = 0; i < display.length; i++) {
    const item = display[i];
    if (item?.type !== "message" || item.role !== "user" || item.content !== text) continue;
    if (item.clientOpId) continue;
    for (let j = i + 1; j < display.length; j++) {
      const after = display[j];
      if (after?.type === "message" && after.role === "assistant") return true;
      if (after?.type === "message" && after.role === "user") break;
    }
  }
  return false;
}

/** 去掉已被服务端同内容 user 消息替代的乐观 pending 副本 */
export function stripRedundantOptimisticDisplay(display: DisplayItem[]): DisplayItem[] {
  return display.filter((item) => {
    if (item.type !== "message" || item.role !== "user" || !item.clientOpId) return true;
    if (item.sendStatus !== "pending" && item.sendStatus !== "sending") return true;
    return !hasServerUserMessage(display, item.content);
  });
}

/** 将 outbox 发送状态同步到 display 中同 clientOpId 的乐观消息（outbox 为 SSOT） */
export function mergeOutboxStatusIntoDisplay(
  display: DisplayItem[],
  entries: ChatOutboxEntry[],
): DisplayItem[] {
  if (entries.length === 0) return display;
  const byOpId = new Map(entries.map((e) => [e.clientOpId, e]));
  return display.map((item) => {
    if (item.type !== "message" || !item.clientOpId) return item;
    const entry = byOpId.get(item.clientOpId);
    if (!entry) return item;
    return { ...item, sendStatus: entry.status };
  });
}

export function filterUndeliveredOutbox(
  display: DisplayItem[],
  entries: ChatOutboxEntry[],
  conversationId: string,
): ChatOutboxEntry[] {
  const serverClientIds = new Set(
    display
      .filter((item) => item.type === "message" && item.clientOpId)
      .map((item) => (item.type === "message" ? item.clientOpId : undefined))
      .filter((id): id is string => Boolean(id)),
  );
  return entries.filter((entry) => {
    if (entry.conversationId !== conversationId) return false;
    if (serverClientIds.has(entry.clientOpId)) return false;
    if (isOutboxDeliveredOnDisplay(display, entry.text)) return false;
    // 刷新/续传：服务端已有同内容 user（助手可能还在生成），勿再拼一条乐观气泡
    if (
      (entry.status === "pending" || entry.status === "sending") &&
      hasServerUserMessage(display, entry.text)
    ) {
      return false;
    }
    return true;
  });
}
